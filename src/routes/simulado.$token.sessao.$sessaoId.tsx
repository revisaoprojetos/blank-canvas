import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Clock, ArrowLeft, ArrowRight, FlagTriangleRight, CheckCircle2, Save,
  Bookmark, X, Eye, EyeOff, MessageSquareWarning, Send,
  Download, CheckCircle, XCircle, MinusCircle, FileText, Trophy,
} from "lucide-react";
import { SimuladoSplashLoader } from "@/components/brand/SimuladoSplashLoader";

import { Markdown } from "@/components/ui/markdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getProvaPorSessao,
  salvarResposta,
  finalizarSessao,
  criarFeedbackQuestao,
  salvarPosicaoQuestao,
} from "@/lib/simulados-publico.functions";
import { GabaritoAlternativas } from "@/components/simulados/GabaritoAlternativas";
import { PdfExportModal, type ModeloPdf } from "@/components/simulados/PdfExportModal";
import { gerarPdfGabarito, gerarPdfProvaCompleta } from "@/lib/gerar-pdf-resultado";

export const Route = createFileRoute("/simulado/$token/sessao/$sessaoId")({
  head: () => ({
    meta: [
      { title: "Prova em andamento" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ProvaSessao,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader><h1 className="font-bold text-destructive">Erro ao carregar a prova</h1></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{error.message}</p></CardContent>
      </Card>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-muted-foreground">Sessão não encontrada.</p>
    </div>
  ),
});

type Alt = { id: string; letra: string; texto: string; correta?: boolean };
type QuestaoLite = {
  id: string;
  enunciado: string;
  disciplina: string | null;
  topico: string | null;
  dificuldade: string | null;
  explicacao?: string | null;
  alternativas: Alt[];
};
type Vinculo = { ordem: number; peso: number; questoes: QuestaoLite | null };

// Paleta de identidade visual — Revisão Ensino Jurídico
const NAV_COLORS = {
  naoRespondida: "#E5E5EA",      // cinza claro
  respondida: "#8572A3",         // roxo claro
  atual: "#4F4A6E",              // roxo principal
  revisao: "#E5B230",            // dourado
  roxo: "#4F4A6E",
  creme: "#FBEFD0",
};

// Embaralhamento agora é PERSISTIDO no servidor (sessoes_prova.ordem_questoes)
// e aplicado antes do payload chegar — o cliente apenas renderiza a ordem
// recebida, garantindo consistência ao recarregar a página.

function fmt(s: number) {
  const sec = Math.max(0, s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

function fmtCurto(seg: number) {
  const sec = Math.max(0, seg);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${m}min`;
}

/** Grade horizontal de blocos [n | letra] usada em vários pop-ups. */
function GabaritoGrid({
  itens,
  onClickItem,
}: {
  itens: { n: number; letra: string | null }[];
  onClickItem?: (i: number) => void;
}) {
  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
      {itens.map((it, i) => {
        const semResp = !it.letra;
        const conteudo = (
          <div
            className="flex items-stretch overflow-hidden rounded-md border shadow-sm"
            style={{ borderColor: NAV_COLORS.roxo }}
          >
            <div
              className="px-2 py-1.5 text-sm font-bold min-w-[36px] text-center"
              style={{ background: NAV_COLORS.roxo, color: "#fff" }}
            >
              {it.n}
            </div>
            <div
              className={cn(
                "flex-1 px-2 py-1.5 text-sm font-bold text-center",
                semResp && "opacity-60",
              )}
              style={{
                background: NAV_COLORS.creme,
                color: NAV_COLORS.roxo,
              }}
            >
              {it.letra ?? "—"}
            </div>
          </div>
        );
        return onClickItem ? (
          <button
            key={i}
            type="button"
            onClick={() => onClickItem(i)}
            className="text-left transition hover:-translate-y-0.5 hover:shadow-md"
            aria-label={`Ir para questão ${it.n}`}
          >
            {conteudo}
          </button>
        ) : (
          <div key={i}>{conteudo}</div>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: "success" | "danger" | "primary" | "muted";
}) {
  const tones: Record<string, string> = {
    success: "from-emerald-500/10 to-emerald-500/5 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    danger: "from-rose-500/10 to-rose-500/5 text-rose-700 dark:text-rose-400 border-rose-500/30",
    primary: "from-primary/15 to-primary/5 text-primary border-primary/30",
    muted: "from-muted to-transparent text-foreground border-border",
  };
  return (
    <div className={cn(
      "rounded-xl border bg-gradient-to-br p-4 shadow-soft hover:shadow-elevated transition-shadow",
      tones[tone],
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</p>
        {icon && <span className="opacity-70">{icon}</span>}
      </div>
      <p className="text-2xl md:text-3xl font-bold tabular-nums mt-1">{value}</p>
    </div>
  );
}

function LegendaItem({ cls, label }: { cls: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("w-3 h-3 rounded border", cls)} />
      <span>{label}</span>
    </div>
  );
}



function ProvaSessao() {
  const { token, sessaoId } = Route.useParams();
  const fetchProva = useServerFn(getProvaPorSessao);
  const salvar = useServerFn(salvarResposta);
  const finalizar = useServerFn(finalizarSessao);

  const { data, isLoading, error } = useQuery({
    queryKey: ["prova_publica", sessaoId],
    queryFn: () => fetchProva({ data: { token, sessao_id: sessaoId } }),
  });

  // Offset entre relógio do servidor e do cliente (ms): serverNow - clientNow
  const serverOffsetRef = useRef<number>(0);
  useEffect(() => {
    if (data?.server_now) {
      serverOffsetRef.current = new Date(data.server_now).getTime() - Date.now();
    }
  }, [data?.server_now]);

  const questoes = useMemo<Vinculo[]>(() => {
    if (!data) return [];
    // Ordem (questões + alternativas) já vem aplicada pelo servidor —
    // consistente entre recarregamentos da mesma sessão.
    return (data.vinculos as unknown as Vinculo[]).filter((v) => v.questoes);
  }, [data]);

  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [revisao, setRevisao] = useState<Record<string, boolean>>({});
  const [idx, setIdx] = useState(0);
  const [agora, setAgora] = useState(Date.now());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showFinalDialog, setShowFinalDialog] = useState(false);
  const [showLateDialog, setShowLateDialog] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [descartadas, setDescartadas] = useState<Record<string, string[]>>({});
  
  const [timerVisivel, setTimerVisivel] = useState(true);
  const lateShownRef = useRef(false);
  const [resultado, setResultado] = useState<{
    acertos?: number;
    erros?: number;
    total_questoes?: number;
    questoesRespondidas?: number;
    pontuacao?: number;
    peso_total?: number;
    aproveitamento?: number;
  } | null>(null);
  const tempoQRef = useRef<number>(Date.now());

  const revisaoKey = `revisao:${sessaoId}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(revisaoKey);
      if (raw) setRevisao(JSON.parse(raw));
    } catch { /* noop */ }
  }, [revisaoKey]);
  useEffect(() => {
    try { sessionStorage.setItem(revisaoKey, JSON.stringify(revisao)); } catch { /* noop */ }
  }, [revisao, revisaoKey]);

  // Recupera última posição: localStorage (instantâneo) → servidor (autoritativo)
  const posKey = `pos:${sessaoId}`;
  const idxRestauradoRef = useRef(false);
  useEffect(() => {
    if (!data || idxRestauradoRef.current) return;
    idxRestauradoRef.current = true;
    let alvo = 0;
    try {
      const raw = localStorage.getItem(posKey);
      if (raw) alvo = Math.max(0, parseInt(raw, 10) || 0);
    } catch { /* noop */ }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serverIdx = Number((data.sessao as any).ultima_questao_idx ?? 0);
    if (serverIdx > alvo) alvo = serverIdx;
    const total = (data.vinculos as unknown[]).length;
    if (total > 0 && alvo >= total) alvo = total - 1;
    if (alvo > 0) setIdx(alvo);
  }, [data, posKey]);

  useEffect(() => {
    if (!data) return;
    const init: Record<string, string> = {};
    for (const r of data.respostas) {
      if (r.alternativa_id) init[r.questao_id] = r.alternativa_id;
    }
    setRespostas(init);
  }, [data]);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { tempoQRef.current = Date.now(); }, [idx]);

  // Persiste a posição da questão atual (debounced) — local + servidor
  const salvarPos = useServerFn(salvarPosicaoQuestao);
  useEffect(() => {
    if (!data || data.sessao.status !== "ativa") return;
    try { localStorage.setItem(posKey, String(idx)); } catch { /* noop */ }
    const t = setTimeout(() => {
      salvarPos({ data: { token, sessao_id: sessaoId, questao_idx: idx } })
        .catch(() => { /* falha silenciosa */ });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, data?.sessao.status]);

  // Marca questão como "visualizada" (resposta em branco) após 15s sem resposta.
  // Garante métrica de tempo gasto mesmo em questões que o aluno não respondeu.
  const visualizadasSalvasRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!data || data.sessao.status !== "ativa") return;
    const q = questoes[idx]?.questoes;
    if (!q) return;
    // Já há resposta ou já registramos visualização — não precisa agendar
    if (respostas[q.id] || visualizadasSalvasRef.current.has(q.id)) return;
    const qid = q.id;
    const t = setTimeout(() => {
      // Revalida: pode ter sido respondida nesse meio tempo
      if (visualizadasSalvasRef.current.has(qid)) return;
      visualizadasSalvasRef.current.add(qid);
      const tempo = Math.floor((Date.now() - tempoQRef.current) / 1000);
      salvar({
        data: {
          token,
          sessao_id: sessaoId,
          questao_id: qid,
          alternativa_id: null,
          tempo_gasto_segundos: tempo,
        },
      }).catch(() => {
        // Falha silenciosa: não bloqueia a prova
        visualizadasSalvasRef.current.delete(qid);
      });
    }, 15_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, data?.sessao.status]);

  // ============ CRONÔMETRO ============
  // Sempre usa o servidor como referência (UTC, sem depender do relógio local).
  // Fim da prova = min(expira_em da sessão, data_fim oficial do simulado).
  const expiraSessao = data?.sessao.expira_em ? new Date(data.sessao.expira_em).getTime() : 0;
  const dataFim = data?.simulado.data_fim ? new Date(data.simulado.data_fim).getTime() : 0;
  const fimEfetivo = dataFim
    ? (expiraSessao ? Math.min(expiraSessao, dataFim) : dataFim)
    : expiraSessao;
  const serverNow = agora + serverOffsetRef.current;
  const restanteSeg = fimEfetivo ? Math.floor((fimEfetivo - serverNow) / 1000) : 0;
  const provaJaEncerrouOficialmente = !!dataFim && serverNow >= dataFim;

  // Entrada tardia: aviso configurável (exibir_popup_atraso + tempo_popup_atraso_minutos)
  const minutosAtrasoExibidos = useRef<number>(0);
  useEffect(() => {
    if (!data || lateShownRef.current) return;
    const sim = data.simulado as typeof data.simulado & {
      exibir_popup_atraso?: boolean;
      tempo_popup_atraso_minutos?: number;
    };
    if (sim.exibir_popup_atraso === false) return;
    const di = sim.data_inicio ? new Date(sim.data_inicio).getTime() : 0;
    if (!di) return;
    const limiarMin = Number(sim.tempo_popup_atraso_minutos ?? 5);
    const now = Date.now() + serverOffsetRef.current;
    const atrasoMin = Math.floor((now - di) / 60_000);
    if (atrasoMin >= limiarMin && data.sessao.status === "ativa") {
      minutosAtrasoExibidos.current = atrasoMin;
      setShowLateDialog(true);
      lateShownRef.current = true;
    }
  }, [data]);

  const mutSalvar = useMutation({
    mutationFn: async (vars: { questao_id: string; alternativa_id: string }) => {
      const tempo = Math.floor((Date.now() - tempoQRef.current) / 1000);
      return salvar({
        data: {
          token,
          sessao_id: sessaoId,
          questao_id: vars.questao_id,
          alternativa_id: vars.alternativa_id,
          tempo_gasto_segundos: tempo,
        },
      });
    },
    onMutate: (vars) => setSavingId(vars.questao_id),
    onSettled: () => setSavingId(null),
    onError: (e: Error) => toast.error(e.message),
  });

  const qc = useQueryClient();
  const mutFinal = useMutation({
    mutationFn: async () => finalizar({ data: { token, sessao_id: sessaoId } }),
    onSuccess: (r) => {
      setResultado(r);
      setShowFinalDialog(false);
      qc.invalidateQueries({ queryKey: ["prova_publica", sessaoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-finalizar quando o tempo zera
  useEffect(() => {
    if (data && restanteSeg <= 0 && data.sessao.status === "ativa" && !resultado && !mutFinal.isPending) {
      mutFinal.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restanteSeg, data?.sessao.status]);

  const toggleRevisao = useCallback((qid: string) => {
    setRevisao((r) => ({ ...r, [qid]: !r[qid] }));
  }, []);

  // Observação de segurança: estudantes NÃO têm acesso ao gabarito
  // (nem visualmente nem em PDF). A exportação de gabarito existe apenas
  // no painel administrativo.

  if (isLoading || (!splashDone && !error)) {
    return (
      <SimuladoSplashLoader
        ready={!isLoading && !!data}
        onComplete={() => setSplashDone(true)}
        label="Carregando prova"
        sublabel="Aguarde alguns instantes"
      />
    );
  }

  if (error || !data) {
    return <div className="min-h-screen flex items-center justify-center text-destructive p-6">Erro: {(error as Error)?.message ?? "Sem dados."}</div>;
  }

  const total = questoes.length;
  const atual = questoes[idx];
  const atualQ = atual?.questoes;
  const respondidas = Object.values(respostas).filter(Boolean).length;
  const naoRespondidas = total - respondidas;
  const lowTime = restanteSeg <= 60;

  // ============ TELA PÓS-PROVA ============
  // Central de revisão da prova encerrada. Cada bloco respeita as regras
  // do organizador (mostrar_resultado, mostrar_gabarito).
  if (resultado || data.sessao.status !== "ativa" || provaJaEncerrouOficialmente) {
    const listaOficial = questoes;
    const mostrarResultado = data.simulado.mostrar_resultado;
    const mostrarGabarito = !!(data.simulado as { mostrar_gabarito?: boolean }).mostrar_gabarito;

    const iniciadaEm = data.sessao.iniciada_em ? new Date(data.sessao.iniciada_em) : null;
    const finalizadaEm = data.sessao.finalizada_em
      ? new Date(data.sessao.finalizada_em)
      : (resultado ? new Date() : null);
    const tempoUtilizadoSeg = iniciadaEm && finalizadaEm
      ? Math.max(0, Math.floor((finalizadaEm.getTime() - iniciadaEm.getTime()) / 1000))
      : 0;

    const respondidasCount = Object.values(respostas).filter(Boolean).length;
    const emBranco = Math.max(0, listaOficial.length - respondidasCount);
    const acertos = resultado?.acertos ?? 0;
    const errosRaw = resultado?.erros;
    const erros = errosRaw ?? Math.max(0, respondidasCount - acertos);
    const aproveitamento = resultado?.aproveitamento
      ?? (listaOficial.length > 0
            ? Math.round((acertos / listaOficial.length) * 1000) / 10
            : 0);
    const pontuacao = Number(resultado?.pontuacao ?? 0);

    const fmtData = (d: Date | null) => d?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) ?? "—";
    const fmtHora = (d: Date | null) => d?.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) ?? "—";

    function statusQuestao(qid: string, alts: Alt[]): "correta" | "errada" | "respondida" | "branco" {
      const rid = respostas[qid];
      if (!rid) return "branco";
      if (mostrarResultado && mostrarGabarito) {
        const alt = alts.find((a) => a.id === rid);
        return alt?.correta ? "correta" : "errada";
      }
      return "respondida";
    }

    function corStatus(s: ReturnType<typeof statusQuestao>) {
      if (s === "correta") return "bg-emerald-500 text-white border-emerald-600";
      if (s === "errada") return "bg-rose-500 text-white border-rose-600";
      if (s === "respondida") return "bg-primary text-primary-foreground border-primary";
      return "bg-muted text-muted-foreground border-border";
    }

    const buildPdfPayload = () => ({
      tituloSimulado: data.simulado.titulo,
      descricaoSimulado: data.simulado.descricao ?? null,
      dataRealizacao: finalizadaEm,
      mostrarResultado,
      mostrarGabarito,
      stats: mostrarResultado
        ? { acertos, erros, emBranco, total: listaOficial.length, aproveitamento, pontuacao }
        : null,
      questoes: listaOficial.map((v, i) => ({
        numero: i + 1,
        questao: v.questoes!,
        marcadaId: respostas[v.questoes!.id] ?? null,
      })),
    });

    const handlePdfSelect = (modelo: ModeloPdf) => {
      const payload = buildPdfPayload();
      if (modelo === "alternativas") void gerarPdfGabarito(payload);
      else void gerarPdfProvaCompleta(payload);
    };

    // Itens do gabarito padronizado (usado na tela e no PDF)
    const itensGabarito = listaOficial.map((v, i) => {
      const q = v.questoes!;
      const rid = respostas[q.id];
      return {
        numero: i + 1,
        letra: rid ? q.alternativas.find((a) => a.id === rid)?.letra ?? null : null,
      };
    });

    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <Toaster />
        <PdfExportModal
          open={showPdfModal}
          onOpenChange={setShowPdfModal}
          onSelect={handlePdfSelect}
        />
        <header className="sticky top-0 z-20 backdrop-blur-md bg-card/85 border-b shadow-sm">
          <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Central de revisão</div>
              <div className="font-semibold text-sm truncate max-w-[420px]">{data.simulado.titulo}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowPdfModal(true)} className="gap-2">
                <Download size={14} /> Baixar PDF
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>



        <div className="max-w-[1200px] mx-auto p-4 md:p-6 space-y-6">
          {/* CABEÇALHO */}
          <Card className="overflow-hidden border-primary/20">
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-xs font-medium text-primary uppercase tracking-wider">
                    <Trophy size={14} /> Simulado Finalizado
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{data.simulado.titulo}</h1>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-sm">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Data</p>
                  <p className="font-semibold">{fmtData(finalizadaEm)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Início</p>
                  <p className="font-semibold tabular-nums">{fmtHora(iniciadaEm)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Término</p>
                  <p className="font-semibold tabular-nums">{fmtHora(finalizadaEm)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Tempo utilizado</p>
                  <p className="font-semibold tabular-nums">{fmtCurto(tempoUtilizadoSeg)}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* RESUMO DE DESEMPENHO */}
          {mostrarResultado ? (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Resumo de desempenho
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label="Acertos" value={acertos} icon={<CheckCircle size={16} />} tone="success" />
                <StatCard label="Erros" value={erros} icon={<XCircle size={16} />} tone="danger" />
                <StatCard label="Em branco" value={emBranco} icon={<MinusCircle size={16} />} tone="muted" />
                <StatCard label="Aproveitamento" value={`${aproveitamento.toFixed(1)}%`} tone="primary" />
                <StatCard label="Pontuação" value={pontuacao.toFixed(2)} tone="primary" />
              </div>
            </div>
          ) : (
            <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900">
              <CardContent className="p-5 flex items-center gap-3">
                <CheckCircle className="text-emerald-600 shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-sm">Sua prova foi enviada com sucesso.</p>
                  <p className="text-xs text-muted-foreground">
                    O organizador optou por não divulgar resultado, acertos e nota.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* GABARITO DE ALTERNATIVAS (modelo padronizado) */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Suas respostas
            </h2>
            <GabaritoAlternativas
              titulo={data.simulado.titulo}
              itens={itensGabarito}
              colsMd={listaOficial.length > 20 ? 10 : 5}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-6">
            <div className="space-y-4 min-w-0">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Questões
              </h2>
              {listaOficial.map((v, i) => {
                const q = v.questoes!;
                const respId = respostas[q.id];
                const respAlt = respId ? q.alternativas.find((a) => a.id === respId) : null;
                const correta = mostrarResultado && mostrarGabarito
                  ? q.alternativas.find((a) => a.correta)
                  : null;
                const st = statusQuestao(q.id, q.alternativas);

                return (
                  <Card
                    key={q.id}
                    id={`questao-${i + 1}`}
                    className="scroll-mt-20 hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-5 md:p-6 space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-bold">
                            Questão {String(i + 1).padStart(2, "0")}
                          </Badge>
                          
                        </div>
                        {!respAlt ? (
                          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                            Não respondida
                          </Badge>
                        ) : mostrarResultado && mostrarGabarito ? (
                          st === "correta" ? (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1">
                              <CheckCircle size={12} /> Acertou
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-500 hover:bg-rose-600 gap-1">
                              <XCircle size={12} /> Errou
                            </Badge>
                          )
                        ) : (
                          <Badge variant="secondary">Respondida</Badge>
                        )}
                      </div>

                      <article>
                        <Markdown className="text-[15px] leading-relaxed">{q.enunciado}</Markdown>
                      </article>

                      <div className="space-y-2">
                        {q.alternativas.map((a) => {
                          const isMarcada = respAlt?.id === a.id;
                          const isCorreta = correta?.id === a.id;
                          return (
                            <div
                              key={a.id}
                              className={cn(
                                "flex items-start gap-3 p-3.5 rounded-lg border-2 transition",
                                isCorreta && !isMarcada && "border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-950/30",
                                isMarcada && !isCorreta && mostrarResultado && mostrarGabarito && "border-rose-500/70 bg-rose-50/60 dark:bg-rose-950/30",
                                isMarcada && isCorreta && "border-emerald-600 bg-emerald-500 text-white",
                                isMarcada && !mostrarGabarito && "border-primary bg-primary text-primary-foreground",
                                !isMarcada && !isCorreta && "border-border bg-card",
                              )}
                            >
                              <span
                                className={cn(
                                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                                  isMarcada && isCorreta && "bg-white text-emerald-700",
                                  isMarcada && !isCorreta && mostrarResultado && mostrarGabarito && "bg-rose-600 text-white",
                                  isMarcada && !mostrarGabarito && "bg-primary-foreground/20 text-primary-foreground",
                                  !isMarcada && isCorreta && "bg-emerald-500 text-white",
                                  !isMarcada && !isCorreta && "bg-muted text-foreground",
                                )}
                              >
                                {a.letra}
                              </span>
                              <div className="flex-1 pt-1 min-w-0">
                                <Markdown className="text-sm">{a.texto}</Markdown>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {isMarcada && (
                                    <span className={cn(
                                      "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                                      isCorreta ? "bg-white/25" : mostrarResultado && mostrarGabarito ? "bg-white/25" : "bg-primary-foreground/20",
                                    )}>
                                      Sua resposta
                                    </span>
                                  )}
                                  {isCorreta && (
                                    <span className={cn(
                                      "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1",
                                      isMarcada ? "bg-white/25" : "bg-emerald-500 text-white",
                                    )}>
                                      <CheckCircle size={10} /> Resposta correta
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {mostrarResultado && mostrarGabarito && q.explicacao && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText size={14} className="text-primary" />
                            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                              Explicação
                            </p>
                          </div>
                          <article>
                            <Markdown className="text-sm">{q.explicacao}</Markdown>
                          </article>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              <div className="text-center pt-2">
                <Button asChild variant="outline">
                  <Link to="/simulado/$token" params={{ token }}>Voltar</Link>
                </Button>
              </div>
            </div>

            {/* NAVEGAÇÃO LATERAL */}
            <aside className="hidden lg:block">
              <div className="sticky top-20 bg-card border rounded-xl p-3 shadow-sm">
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Questões</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {listaOficial.map((v, i) => {
                    const st = statusQuestao(v.questoes!.id, v.questoes!.alternativas);
                    return (
                      <a
                        key={v.questoes!.id}
                        href={`#questao-${i + 1}`}
                        className={cn(
                          "aspect-square text-xs font-bold rounded border flex items-center justify-center hover:scale-105 transition",
                          corStatus(st),
                        )}
                        aria-label={`Ir para questão ${i + 1}`}
                      >
                        {i + 1}
                      </a>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t space-y-1.5 text-[11px]">
                  <LegendaItem cls="bg-muted border-border" label="Em branco" />
                  {mostrarResultado && mostrarGabarito ? (
                    <>
                      <LegendaItem cls="bg-emerald-500 border-emerald-600" label="Correta" />
                      <LegendaItem cls="bg-rose-500 border-rose-600" label="Errada" />
                    </>
                  ) : (
                    <LegendaItem cls="bg-primary border-primary" label="Respondida" />
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }





  if (total === 0) {
    return <div className="min-h-screen flex items-center justify-center p-6 text-muted-foreground">Este simulado não possui questões.</div>;
  }

  const respAtual = atualQ ? respostas[atualQ.id] : undefined;
  const isRevisao = atualQ ? !!revisao[atualQ.id] : false;

  function corNav(qid: string, ativa: boolean): string {
    if (ativa) return NAV_COLORS.atual;
    if (revisao[qid]) return NAV_COLORS.revisao;
    if (respostas[qid]) return NAV_COLORS.respondida;
    return NAV_COLORS.naoRespondida;
  }
  function corTextoNav(qid: string, ativa: boolean): string {
    if (ativa) return "#ffffff";              // Atual (roxo) → texto branco
    if (revisao[qid]) return "#2A2A2A";        // Em revisão (dourado) → texto escuro
    if (respostas[qid]) return "#ffffff";      // Respondida (roxo claro) → texto branco
    return "#4F4A6E";                          // Não respondida (cinza claro) → roxo
  }

  // Itens da grade para o pop-up de finalização (resposta do aluno)
  const respostasItens = questoes.map((v, i) => {
    const q = v.questoes!;
    const respId = respostas[q.id];
    const letra = respId ? q.alternativas.find((a) => a.id === respId)?.letra ?? null : null;
    return { n: i + 1, letra };
  });

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="sticky top-0 z-20 bg-card border-b shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] uppercase text-muted-foreground">Prova</div>
            <div className="font-semibold text-sm truncate max-w-[260px]">{data.simulado.titulo}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            {respondidas}/{total} respondidas
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold tabular-nums",
                lowTime
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-primary text-primary-foreground",
              )}
              title="Horário de Brasília (sincronizado pelo servidor)"
            >
              <Clock size={16} />
              <span>{timerVisivel ? fmt(restanteSeg) : "--:--:--"}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTimerVisivel((v) => !v)}
              title={timerVisivel ? "Ocultar cronômetro" : "Mostrar cronômetro"}
            >
              {timerVisivel ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowFinalDialog(true)}
            >
              <FlagTriangleRight size={14} className="mr-1" /> Finalizar Simulado
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className={cn(
        "max-w-[1600px] mx-auto p-4 gap-4 grid grid-cols-1",
        data.simulado.permitir_revisao && "lg:grid-cols-[minmax(0,1fr)_280px]",
      )}>
        <main className="space-y-4 min-w-0">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 flex-wrap pb-2 border-b">
                <Badge>Questão {idx + 1} / {total}</Badge>
                {isRevisao && (
                  <Badge style={{ background: NAV_COLORS.revisao, color: "#2A2A2A" }}>
                    <Bookmark size={11} className="mr-1" /> Marcada para revisão
                  </Badge>
                )}
              </div>
              <article className="prose prose-base dark:prose-invert max-w-none">
                <Markdown>{atualQ?.enunciado ?? ""}</Markdown>
              </article>
              <div className="space-y-0 pl-0">
                {atualQ?.alternativas.map((a, i) => {
                  const letra = data.simulado.embaralhar_alternativas
                    ? String.fromCharCode(65 + i) : a.letra;
                  const sel = respAtual === a.id;
                  const cortadas = descartadas[atualQ.id] ?? [];
                  const marcada = cortadas.includes(a.id);
                  const toggleCorte = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setDescartadas((d) => {
                      const cur = d[atualQ.id] ?? [];
                      const next = cur.includes(a.id)
                        ? cur.filter((x) => x !== a.id)
                        : [...cur, a.id];
                      return { ...d, [atualQ.id]: next };
                    });
                  };
                  return (
                    <div
                      key={a.id}
                      className={cn("alt-row", marcada && "marcada")}
                    >
                      <div className="alt-scissor-col">
                        <button
                          type="button"
                          onClick={toggleCorte}
                          className={cn("alt-scissor-btn", marcada && "marcada")}
                          title={marcada ? "Restaurar alternativa" : "Descartar alternativa"}
                          aria-label={marcada ? "Restaurar alternativa" : "Descartar alternativa"}
                        >
                          ✂
                        </button>
                        <span className="trace-right" aria-hidden />
                      </div>
                      <button
                        type="button"
                        disabled={marcada}
                        onClick={() => {
                          if (marcada) return;
                          setRespostas((r) => ({ ...r, [atualQ.id]: a.id }));
                          mutSalvar.mutate({ questao_id: atualQ.id, alternativa_id: a.id });
                        }}
                        className={cn(
                          "alt-item flex-1 text-left flex items-start gap-3 p-4 rounded-xl border-2 transition",
                          sel
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <span className={cn(
                          "alt-letra shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold",
                          sel ? "bg-primary text-primary-foreground" : "bg-muted",
                        )}>
                          {letra}
                        </span>
                        <div className="alt-txt flex-1 pt-1.5">
                          <Markdown className="text-sm">{a.texto}</Markdown>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>
                  {savingId === atualQ?.id ? (
                    <span className="flex items-center gap-1"><Save size={12} className="animate-pulse" /> Salvando...</span>
                  ) : respAtual ? (
                    <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> Salvo</span>
                  ) : (
                    "Selecione uma alternativa para salvar."
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            {data.simulado.permitir_revisao ? (
              <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
                <ArrowLeft size={14} className="mr-1" /> Anterior
              </Button>
            ) : (
              <span />
            )}
            {data.simulado.permitir_revisao && (
              <Button
                onClick={() => atualQ && toggleRevisao(atualQ.id)}
                style={{
                  background: isRevisao ? NAV_COLORS.revisao : NAV_COLORS.atual,
                  color: isRevisao ? "#2A2A2A" : "#ffffff",
                }}
                className="hover:opacity-90"
              >
                <Bookmark size={14} className="mr-1" />
                {isRevisao ? "Desmarcar revisão" : "Revisar"}
              </Button>
            )}
            {idx >= total - 1 && !data.simulado.permitir_revisao ? (
              <Button
                variant="destructive"
                onClick={() => setShowFinalDialog(true)}
              >
                <FlagTriangleRight size={14} className="mr-1" /> Finalizar
              </Button>
            ) : (
              <Button disabled={idx >= total - 1} onClick={() => setIdx((i) => i + 1)}>
                Próxima <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>


          {data.simulado.mostrar_feedbacks && atualQ && (
            <div className="flex items-center justify-end">
              <FeedbackQuestaoButton
                token={token}
                sessaoId={sessaoId}
                questaoId={atualQ.id}
              />
            </div>
          )}
        </main>

        {data.simulado.permitir_revisao && (
          <aside className="bg-card border rounded-xl p-3 h-fit lg:sticky lg:top-20">
            <p className="text-xs font-semibold mb-2">Navegação</p>
            <div className="grid grid-cols-5 gap-1.5">
              {questoes.map((q, i) => {
                const qid = q.questoes?.id ?? "";
                const ativa = i === idx;
                const bg = corNav(qid, ativa);
                const color = corTextoNav(qid, ativa);
                return (
                  <button
                    key={qid || i}
                    onClick={() => setIdx(i)}
                    className={cn(
                      "aspect-square text-xs font-bold rounded transition relative",
                      ativa && "ring-2 ring-offset-2 ring-offset-background",
                    )}
                    style={{ background: bg, color, ...(ativa ? { boxShadow: `0 0 0 2px ${NAV_COLORS.atual}` } : {}) }}
                    aria-label={`Ir para questão ${i + 1}`}
                  >
                    {i + 1}
                    {revisao[qid] && !ativa && (
                      <Bookmark size={8} className="absolute top-0.5 right-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: NAV_COLORS.naoRespondida }} />
                <span>Não respondida</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: NAV_COLORS.respondida }} />
                <span>Respondida</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: NAV_COLORS.atual }} />
                <span>Atual</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: NAV_COLORS.revisao }} />
                <span>Em revisão</span>
              </div>
            </div>
          </aside>
        )}

      </div>

      {/* Pop-up de entrada tardia */}
      <AlertDialog open={showLateDialog} onOpenChange={setShowLateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você está entrando com atraso</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Este simulado já foi iniciado há{" "}
                  <strong>{minutosAtrasoExibidos.current} minuto{minutosAtrasoExibidos.current === 1 ? "" : "s"}</strong>.
                </p>
                <p className="text-muted-foreground">
                  Seu tempo disponível continuará sendo calculado conforme as regras da aplicação e poderá ser reduzido conforme o horário limite do simulado.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de revisão e finalização — grade horizontal */}
      <Dialog open={showFinalDialog} onOpenChange={setShowFinalDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Revisar e finalizar</DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm">
                Você respondeu <strong className="text-primary">{respondidas}</strong> de{" "}
                <strong>{total}</strong> questões.
                {naoRespondidas > 0 && (
                  <span className="block mt-1 text-destructive">
                    {naoRespondidas} questão(ões) ainda não foram respondidas.
                  </span>
                )}
                {data.simulado.permitir_revisao && (
                  <span className="block mt-1 text-muted-foreground text-xs">
                    Clique em uma questão para voltar a ela.
                  </span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          {data.simulado.permitir_revisao && (
            <div className="flex-1 overflow-y-auto p-1">
              <GabaritoGrid
                itens={respostasItens}
                onClickItem={(i) => { setIdx(i); setShowFinalDialog(false); }}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalDialog(false)}>
              <X size={14} className="mr-1" /> Cancelar
            </Button>
            <Button variant="destructive" onClick={() => mutFinal.mutate()} disabled={mutFinal.isPending}>
              <FlagTriangleRight size={14} className="mr-1" />
              {mutFinal.isPending ? "Finalizando..." : "Finalizar Simulado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =================== Feedback de questão ===================

const FEEDBACK_OPCOES: { value: string; label: string }[] = [
  { value: "reportar_erro", label: "Reportar erro" },
  { value: "duplicada", label: "Questão duplicada" },
  { value: "desatualizada", label: "Questão desatualizada" },
  { value: "gabarito_incorreto", label: "Gabarito incorreto" },
  { value: "enunciado_confuso", label: "Enunciado confuso" },
  { value: "alternativa_incorreta", label: "Alternativa incorreta" },
  { value: "comentario_incorreto", label: "Comentário/explicação incorreta" },
];

function FeedbackQuestaoButton({
  token, sessaoId, questaoId,
}: { token: string; sessaoId: string; questaoId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-xs"
      >
        <MessageSquareWarning size={14} className="mr-1" />
        Reportar feedback
      </Button>
      {open && (
        <FeedbackQuestaoDialog
          open={open}
          onOpenChange={setOpen}
          token={token}
          sessaoId={sessaoId}
          questaoId={questaoId}
        />
      )}
    </>
  );
}

function FeedbackQuestaoDialog({
  open, onOpenChange, token, sessaoId, questaoId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string;
  sessaoId: string;
  questaoId: string;
}) {
  const criar = useServerFn(criarFeedbackQuestao);

  const [tipo, setTipo] = useState<string>("reportar_erro");
  const [mensagem, setMensagem] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      criar({
        data: {
          token,
          sessao_id: sessaoId,
          questao_id: questaoId,
          tipo: tipo as never,
          mensagem,
        },
      }),
    onSuccess: () => {
      toast.success("Feedback enviado. Obrigado!");
      setMensagem("");
      setTipo("reportar_erro");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning size={18} /> Enviar feedback da questão
          </DialogTitle>
          <DialogDescription>
            Reporte erros, dúvidas ou sugestões sobre esta questão para o organizador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
          <div className="grid sm:grid-cols-[200px_1fr] gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEEDBACK_OPCOES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
                placeholder="Descreva o problema ou sugestão..."
                maxLength={2000}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => mut.mutate()}
              disabled={mut.isPending || mensagem.trim().length < 3}
            >
              <Send size={14} className="mr-1" />
              {mut.isPending ? "Enviando..." : "Enviar feedback"}
            </Button>
          </div>
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X size={14} className="mr-1" /> Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
