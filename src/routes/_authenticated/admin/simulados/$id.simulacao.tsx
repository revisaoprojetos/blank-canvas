import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronsLeft, Clock, FlagTriangleRight,
  Info, CheckCircle2, XCircle, RotateCcw, Eye, Flag, Eraser, HelpCircle,
  Wifi, WifiOff, Save, BookOpen, Layers,
} from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/simulados/$id/simulacao")({
  head: () => ({ meta: [{ title: "Simulação real — Painel Admin" }] }),
  component: SimulacaoReal,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">Erro: {error.message}</div>,
  notFoundComponent: () => <div className="p-8">Simulado não encontrado.</div>,
});

type Simulado = {
  id: string;
  titulo: string;
  descricao: string | null;
  instrucoes: string | null;
  duracao_minutos: number;
  embaralhar_questoes: boolean;
  embaralhar_alternativas: boolean;
  mostrar_gabarito: boolean;
  permitir_revisao: boolean;
};

type Vinculo = {
  ordem: number;
  peso: number;
  questoes: {
    id: string;
    enunciado: string;
    disciplina: string | null;
    topico: string | null;
    dificuldade: string | null;
    explicacao: string | null;
    alternativas: { id: string; letra: string; texto: string; correta: boolean }[];
  } | null;
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fmtTime(totalSec: number) {
  const s = Math.max(0, totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

// ============================================================
// Subcomponents
// ============================================================

function ExamTimer({ secondsLeft }: { secondsLeft: number }) {
  const low = secondsLeft <= 60;
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold tabular-nums transition",
        low
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : "bg-[var(--exam-review)] text-white",
      )}
      aria-label="Tempo restante"
    >
      <Clock size={16} />
      <span className="text-base">{fmtTime(secondsLeft)}</span>
    </div>
  );
}

function ProgressBar({ answered, total }: { answered: number; total: number }) {
  const pct = total ? (answered / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {answered}/{total} respondidas
      </div>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-[var(--exam-current)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AutoSaveIndicator({
  online,
  saving,
  savedAt,
}: { online: boolean; saving: boolean; savedAt: number | null }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {online ? (
        <Wifi size={14} className="text-emerald-500" />
      ) : (
        <WifiOff size={14} className="text-destructive" />
      )}
      <span className="hidden sm:inline">
        {saving ? (
          <span className="flex items-center gap-1">
            <Save size={12} className="animate-pulse" /> Salvando…
          </span>
        ) : savedAt ? (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={12} /> Salvo automaticamente
          </span>
        ) : (
          "Aguardando resposta"
        )}
      </span>
    </div>
  );
}

function QuestionHeader({
  numero, total, disciplina, topico, dificuldade, peso, tempoSeg,
}: {
  numero: number; total: number;
  disciplina?: string | null; topico?: string | null; dificuldade?: string | null;
  peso: number; tempoSeg: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-[var(--exam-review)] text-white text-sm px-3 py-1">
          Questão {numero} <span className="opacity-70">/ {total}</span>
        </Badge>
        {disciplina && (
          <Badge variant="secondary" className="gap-1">
            <BookOpen size={12} /> {disciplina}
          </Badge>
        )}
        {topico && <Badge variant="outline">{topico}</Badge>}
        {dificuldade && (
          <Badge variant="outline" className="capitalize">
            <Layers size={12} className="mr-1" />
            {dificuldade}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Vale <strong className="text-foreground">{peso.toFixed(2)}</strong> ponto(s)</span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> {fmtTime(tempoSeg)} nesta questão
        </span>
      </div>
    </div>
  );
}

function AlternativeCard({
  letra, texto, selecionada, onSelect, atalho,
}: {
  letra: string; texto: string; selecionada: boolean;
  onSelect: () => void; atalho: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left flex items-start gap-3 p-4 rounded-xl border-2 transition-all",
        "hover:border-[var(--exam-current)] hover:bg-[var(--exam-current)]/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--exam-current)]",
        selecionada
          ? "border-[var(--exam-answered)] bg-[var(--exam-answered)]/10 shadow-sm"
          : "border-border bg-card",
      )}
      aria-pressed={selecionada}
    >
      <span
        className={cn(
          "shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-base transition",
          selecionada
            ? "bg-[var(--exam-answered)] text-white"
            : "bg-muted text-foreground",
        )}
      >
        {letra}
      </span>
      <div className="flex-1 pt-1.5">
        <Markdown className="text-sm leading-relaxed">{texto}</Markdown>
      </div>
      <kbd className="hidden md:inline-flex shrink-0 mt-1 px-2 py-0.5 text-[10px] font-mono rounded border border-border text-muted-foreground">
        {atalho}
      </kbd>
    </button>
  );
}

type EstadoQuestao = "atual" | "respondida" | "revisao" | "nao_respondida";

function bgFor(estado: EstadoQuestao) {
  switch (estado) {
    case "atual": return "bg-[var(--exam-current)] text-[#1F2937] ring-2 ring-[var(--exam-current)] ring-offset-2 ring-offset-background";
    case "respondida": return "bg-[var(--exam-answered)] text-white";
    case "revisao": return "bg-[var(--exam-review)] text-white";
    default: return "bg-[var(--exam-unanswered)] text-[#1F2937] border border-border";
  }
}

function QuestionNavigator({
  total, idxAtual, respostas, marcadas, ordemIds, onJump,
}: {
  total: number; idxAtual: number;
  respostas: Record<string, string>; marcadas: Set<string>;
  ordemIds: string[]; onJump: (i: number) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const qid = ordemIds[i];
        const respondida = qid && respostas[qid];
        const marcada = qid && marcadas.has(qid);
        const estado: EstadoQuestao =
          i === idxAtual ? "atual" : marcada ? "revisao" : respondida ? "respondida" : "nao_respondida";
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            className={cn(
              "aspect-square text-xs font-bold rounded-md transition hover:scale-105",
              bgFor(estado),
            )}
            aria-label={`Ir para questão ${i + 1}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

function LegendaItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn("w-3.5 h-3.5 rounded", color)} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function ExamSidebar({
  total, idxAtual, respostas, marcadas, ordemIds, onJump, onFinalizar,
}: {
  total: number; idxAtual: number;
  respostas: Record<string, string>; marcadas: Set<string>;
  ordemIds: string[];
  onJump: (i: number) => void;
  onFinalizar: () => void;
}) {
  const respondidas = Object.keys(respostas).length;
  const pendentes = total - respondidas;
  const revisao = marcadas.size;
  const pct = total ? Math.round((respondidas / total) * 100) : 0;

  return (
    <aside className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4 sticky top-20">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm text-foreground">Painel de Navegação</h2>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>

      <QuestionNavigator
        total={total}
        idxAtual={idxAtual}
        respostas={respostas}
        marcadas={marcadas}
        ordemIds={ordemIds}
        onJump={onJump}
      />

      <div className="space-y-1.5 pt-2 border-t border-border">
        <LegendaItem color="bg-[var(--exam-current)]" label="Questão atual" />
        <LegendaItem color="bg-[var(--exam-answered)]" label="Respondida" />
        <LegendaItem color="bg-[var(--exam-review)]" label="Marcada para revisão" />
        <LegendaItem color="bg-[var(--exam-unanswered)] border border-border" label="Não respondida" />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
        <div>
          <div className="text-lg font-bold text-[var(--exam-answered)]">{respondidas}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Respondidas</div>
        </div>
        <div>
          <div className="text-lg font-bold text-[var(--exam-current)]">{pendentes}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Pendentes</div>
        </div>
        <div>
          <div className="text-lg font-bold text-[var(--exam-review)]">{revisao}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Revisão</div>
        </div>
      </div>

      <Button
        className="w-full bg-[var(--exam-review)] text-white hover:bg-[var(--exam-review)]/90"
        onClick={onFinalizar}
      >
        <FlagTriangleRight size={14} className="mr-1" /> Finalizar Tentativa
      </Button>
    </aside>
  );
}

// ============================================================
// Main
// ============================================================

function SimulacaoReal() {
  const { id } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["simulacao_real", id],
    queryFn: async () => {
      const { data: s, error: e1 } = await supabase
        .from("simulados").select("*").eq("id", id).maybeSingle();
      if (e1) throw e1;
      if (!s) throw notFound();

      const { data: v, error: e2 } = await supabase
        .from("questao_simulado")
        .select("ordem, peso, questoes(id, enunciado, disciplina, topico, dificuldade, explicacao, alternativas(id, letra, texto, correta))")
        .eq("simulado_id", id)
        .order("ordem");
      if (e2) throw e2;
      return { simulado: s as Simulado, vinculos: (v ?? []) as unknown as Vinculo[] };
    },
  });

  const questoes = useMemo(() => {
    if (!data) return [];
    const lista = data.vinculos.filter((v) => v.questoes);
    const base = data.simulado.embaralhar_questoes ? shuffle(lista) : lista;
    return base.map((v) => ({
      ...v,
      questoes: v.questoes
        ? {
            ...v.questoes,
            alternativas: data.simulado.embaralhar_alternativas
              ? shuffle(v.questoes.alternativas)
              : [...v.questoes.alternativas].sort((a, b) => a.letra.localeCompare(b.letra)),
          }
        : null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.simulado.id]);

  const [iniciado, setIniciado] = useState(false);
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [finalizado, setFinalizado] = useState(false);
  const inicioRef = useRef<number | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const tempoQuestaoRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!iniciado || finalizado) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [iniciado, finalizado]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    tempoQuestaoRef.current = Date.now();
  }, [idx]);

  const duracaoSeg = (data?.simulado.duracao_minutos ?? 0) * 60;
  const restanteSeg = iniciado && inicioRef.current
    ? duracaoSeg - Math.floor((agora - inicioRef.current) / 1000)
    : duracaoSeg;

  useEffect(() => {
    if (iniciado && !finalizado && restanteSeg <= 0) setFinalizado(true);
  }, [restanteSeg, iniciado, finalizado]);

  const handleResposta = useCallback((qid: string, altId: string) => {
    setSaving(true);
    setRespostas((r) => ({ ...r, [qid]: altId }));
    setTimeout(() => {
      setSaving(false);
      setSavedAt(Date.now());
    }, 400);
  }, []);

  const toggleMarcada = useCallback((qid: string) => {
    setMarcadas((m) => {
      const next = new Set(m);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }, []);

  const limparResposta = useCallback((qid: string) => {
    setRespostas((r) => {
      const { [qid]: _, ...rest } = r;
      return rest;
    });
  }, []);

  // Keyboard nav
  const total = questoes.length;
  const atual = questoes[idx];
  const atualId = atual?.questoes?.id;

  useEffect(() => {
    if (!iniciado || finalizado || !atual?.questoes) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const letras = ["a", "b", "c", "d", "e"];
      const i = letras.indexOf(e.key.toLowerCase());
      if (i >= 0 && atual.questoes!.alternativas[i]) {
        handleResposta(atual.questoes!.id, atual.questoes!.alternativas[i].id);
      } else if (e.key === "ArrowRight" && idx < total - 1) {
        setIdx((x) => x + 1);
      } else if (e.key === "ArrowLeft" && idx > 0) {
        setIdx((x) => x - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [iniciado, finalizado, atual, idx, total, handleResposta]);

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando...</div>;
  if (error || !data) return <div className="p-8 text-destructive">Erro ao carregar.</div>;

  const pesoTotal = data.vinculos.reduce((s, v) => s + Number(v.peso), 0);
  const ordemIds = questoes.map((q) => q.questoes?.id ?? "");

  if (total === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link to="/admin/simulados" className="inline-flex items-center gap-1 text-sm text-secondary hover:underline mb-4">
          <ChevronLeft size={14} /> Voltar
        </Link>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Este simulado ainda não tem questões vinculadas.</p>
        </Card>
      </div>
    );
  }

  // ===== Tela final =====
  if (finalizado) {
    let acertos = 0;
    let pontuacao = 0;
    questoes.forEach((q) => {
      if (!q.questoes) return;
      const escolhida = respostas[q.questoes.id];
      const correta = q.questoes.alternativas.find((a) => a.correta);
      if (escolhida && correta && escolhida === correta.id) {
        acertos += 1;
        pontuacao += Number(q.peso);
      }
    });
    const pct = pesoTotal > 0 ? (pontuacao / pesoTotal) * 100 : 0;

    return (
      <div className="min-h-screen bg-[var(--exam-surface)]">
        <div className="bg-[var(--exam-review)] text-white px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2"><Eye size={14} /> Simulação (modo administrador)</div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-7 w-7 text-white hover:bg-white/10 hover:text-white" />
            <Button asChild size="sm" variant="secondary" className="h-7">
              <Link to="/admin/simulados"><ChevronLeft size={12} className="mr-1" /> Voltar à lista</Link>
            </Button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <Card>
            <CardHeader>
              <h1 className="text-2xl font-bold text-primary">Resultado da simulação</h1>
              <p className="text-sm text-muted-foreground">{data.simulado.titulo}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border p-4">
                  <div className="text-2xl font-bold text-primary">{acertos}/{total}</div>
                  <div className="text-xs text-muted-foreground">Acertos</div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="text-2xl font-bold text-primary">{pontuacao.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">Pontuação ({pesoTotal.toFixed(2)})</div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="text-2xl font-bold text-[var(--exam-current)]">{pct.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Aproveitamento</div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setRespostas({}); setMarcadas(new Set()); setIdx(0);
                  setFinalizado(false); setIniciado(false); inicioRef.current = null;
                }}
              >
                <RotateCcw size={14} className="mr-1" /> Refazer simulação
              </Button>
            </CardContent>
          </Card>

          {data.simulado.permitir_revisao && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-primary">Revisão</h2>
              {questoes.map((q, i) => {
                if (!q.questoes) return null;
                const escolhida = respostas[q.questoes.id];
                const correta = q.questoes.alternativas.find((a) => a.correta);
                const acertou = escolhida && correta && escolhida === correta.id;
                return (
                  <Card key={q.questoes.id} className={`border-l-4 ${acertou ? "border-l-emerald-500" : "border-l-destructive"}`}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge>Questão {i + 1}</Badge>
                        {acertou ? (
                          <span className="text-emerald-600 text-sm flex items-center gap-1"><CheckCircle2 size={14} /> Correta</span>
                        ) : (
                          <span className="text-destructive text-sm flex items-center gap-1"><XCircle size={14} /> {escolhida ? "Incorreta" : "Não respondida"}</span>
                        )}
                      </div>
                      <Markdown>{q.questoes.enunciado}</Markdown>
                      <div className="space-y-1">
                        {q.questoes.alternativas.map((a, ai) => {
                          const letra = data.simulado.embaralhar_alternativas
                            ? String.fromCharCode(65 + ai) : a.letra;
                          const ehEscolhida = escolhida === a.id;
                          return (
                            <div
                              key={a.id}
                              className={cn(
                                "flex items-start gap-2 rounded-md border p-2 text-sm",
                                a.correta ? "border-emerald-500 bg-emerald-500/10"
                                : ehEscolhida ? "border-destructive bg-destructive/10"
                                : "border-border",
                              )}
                            >
                              <span className="font-bold w-5">{letra}</span>
                              <Markdown className="flex-1">{a.texto}</Markdown>
                            </div>
                          );
                        })}
                      </div>
                      {q.questoes.explicacao && (
                        <div className="border-l-4 border-secondary bg-secondary/5 p-3 text-sm">
                          <p className="font-semibold text-primary mb-1">Explicação</p>
                          <Markdown className="text-muted-foreground">{q.questoes.explicacao}</Markdown>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== Tela inicial =====
  if (!iniciado) {
    return (
      <div className="min-h-screen bg-[var(--exam-surface)]">
        <div className="bg-[var(--exam-review)] text-white px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2"><Eye size={14} /> Simulação (modo administrador)</div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-7 w-7 text-white hover:bg-white/10 hover:text-white" />
            <Button asChild size="sm" variant="secondary" className="h-7">
              <Link to="/admin/simulados"><ChevronLeft size={12} className="mr-1" /> Voltar</Link>
            </Button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-8">
          <Card className="rounded-2xl">
            <CardHeader>
              <h1 className="text-2xl font-bold text-primary">{data.simulado.titulo}</h1>
              {data.simulado.descricao && (
                <p className="text-muted-foreground">{data.simulado.descricao}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border p-4 flex items-center gap-2">
                  <Clock size={16} className="text-[var(--exam-current)]" />
                  <div>
                    <div className="font-semibold">{data.simulado.duracao_minutos} min</div>
                    <div className="text-xs text-muted-foreground">Tempo total</div>
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="font-semibold">{total} questões</div>
                  <div className="text-xs text-muted-foreground">Peso total: {pesoTotal.toFixed(2)}</div>
                </div>
              </div>
              {data.simulado.instrucoes && (
                <Card className="border-secondary/40 bg-secondary/5">
                  <CardContent className="pt-4 flex gap-2 text-sm">
                    <Info size={16} className="text-secondary shrink-0 mt-0.5" />
                    <Markdown className="flex-1">{data.simulado.instrucoes}</Markdown>
                  </CardContent>
                </Card>
              )}
              <Button
                className="w-full bg-[var(--exam-current)] text-[#1F2937] hover:bg-[var(--exam-current)]/90 font-semibold"
                size="lg"
                onClick={() => {
                  inicioRef.current = Date.now();
                  setAgora(Date.now());
                  setIniciado(true);
                }}
              >
                Iniciar simulação
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Esta é uma simulação local para o administrador. Nada é gravado no banco.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ===== Tela de prova =====
  const respostaAtual = atualId ? respostas[atualId] : undefined;
  const marcadaAtual = atualId ? marcadas.has(atualId) : false;
  const respondidas = Object.keys(respostas).length;
  const tempoNaQuestao = Math.floor((agora - tempoQuestaoRef.current) / 1000);

  return (
    <div className="min-h-screen bg-[var(--exam-surface)]">
      {/* HEADER FIXO */}
      <header className="sticky top-0 z-20 bg-card border-b border-border shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[var(--exam-review)] text-white flex items-center justify-center font-bold">
              S
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Simulado</div>
              <div className="font-semibold text-sm truncate max-w-[260px]">{data.simulado.titulo}</div>
            </div>
          </div>

          <ProgressBar answered={respondidas} total={total} />

          <div className="flex items-center gap-2">
            <ExamTimer secondsLeft={restanteSeg} />
            <AutoSaveIndicator online={online} saving={saving} savedAt={savedAt} />
            <Button size="icon" variant="ghost" aria-label="Ajuda">
              <HelpCircle size={18} />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* CONTEÚDO CENTRAL */}
        <main className="space-y-4 min-w-0">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6 space-y-5">
              <QuestionHeader
                numero={idx + 1}
                total={total}
                disciplina={atual.questoes?.disciplina}
                topico={atual.questoes?.topico}
                dificuldade={atual.questoes?.dificuldade}
                peso={Number(atual.peso)}
                tempoSeg={tempoNaQuestao}
              />

              <article className="prose prose-sm dark:prose-invert max-w-none">
                <Markdown>{atual.questoes?.enunciado ?? ""}</Markdown>
              </article>

              <div className="space-y-2">
                {atual.questoes?.alternativas.map((a, i) => {
                  const letra = data.simulado.embaralhar_alternativas
                    ? String.fromCharCode(65 + i) : a.letra;
                  return (
                    <AlternativeCard
                      key={a.id}
                      letra={letra}
                      texto={a.texto}
                      selecionada={respostaAtual === a.id}
                      atalho={letra.toUpperCase()}
                      onSelect={() => atualId && handleResposta(atualId, a.id)}
                    />
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={marcadaAtual ? "default" : "outline"}
                    size="sm"
                    onClick={() => atualId && toggleMarcada(atualId)}
                    className={cn(
                      marcadaAtual && "bg-[var(--exam-review)] text-white hover:bg-[var(--exam-review)]/90",
                    )}
                  >
                    <Flag size={14} className="mr-1" />
                    {marcadaAtual ? "Marcada para revisão" : "Marcar para revisão"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!respostaAtual}
                    onClick={() => atualId && limparResposta(atualId)}
                  >
                    <Eraser size={14} className="mr-1" /> Limpar resposta
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground hidden md:inline">
                  Dica: use A–E e ←/→ para navegar
                </span>
              </div>
            </CardContent>
          </Card>

          {/* RODAPÉ DA QUESTÃO */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => setIdx(0)}>
                <ChevronsLeft size={14} className="mr-1" /> Primeira
              </Button>
              <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
                <ArrowLeft size={14} className="mr-1" /> Anterior
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={idx === total - 1}
                onClick={() => setIdx((i) => i + 1)}
                className="bg-[var(--exam-current)] text-[#1F2937] hover:bg-[var(--exam-current)]/90 font-semibold"
              >
                Próxima <ArrowRight size={14} className="ml-1" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="bg-[var(--exam-review)] text-white hover:bg-[var(--exam-review)]/90">
                    <FlagTriangleRight size={14} className="mr-1" /> Finalizar Simulado
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Finalizar simulação?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Você respondeu {respondidas} de {total} questões. Tem certeza?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setFinalizado(true)}>Finalizar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </main>

        {/* SIDEBAR DIREITA */}
        <ExamSidebar
          total={total}
          idxAtual={idx}
          respostas={respostas}
          marcadas={marcadas}
          ordemIds={ordemIds}
          onJump={setIdx}
          onFinalizar={() => setFinalizado(true)}
        />
      </div>
    </div>
  );
}
