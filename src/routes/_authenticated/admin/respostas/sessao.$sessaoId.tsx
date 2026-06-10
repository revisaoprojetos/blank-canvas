import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Download, Eye, EyeOff,
} from "lucide-react";
import { formatBrasilia } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";

export const Route = createFileRoute("/_authenticated/admin/respostas/sessao/$sessaoId")({
  head: () => ({ meta: [{ title: "Detalhe da Sessão — Painel Admin" }] }),
  component: SessaoDetalhe,
});

function formatDuration(s: number) {
  if (!s || s < 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

type Sessao = {
  id: string;
  estudante_id: string;
  simulado_id: string;
  status: string;
  iniciada_em: string;
  finalizada_em: string | null;
  total_questoes: number | null;
  acertos: number | null;
  pontuacao: number | null;
  ordem_questoes: unknown;
  estudantes: { id: string; email: string; nome: string | null } | null;
  simulados: { id: string; titulo: string; duracao_minutos: number } | null;
};

type Alternativa = { id: string; letra: string; texto: string; correta: boolean };
type Questao = {
  id: string; enunciado: string; disciplina: string | null;
  topico: string | null; explicacao: string | null;
  alternativas: Alternativa[];
};
type Resposta = {
  id: string; questao_id: string; alternativa_id: string | null;
  correta: boolean | null; tempo_gasto_segundos: number | null; marcada_em: string;
};

function SessaoDetalhe() {
  const { sessaoId } = useParams({ from: "/_authenticated/admin/respostas/sessao/$sessaoId" });
  const navigate = useNavigate();

  const { data: sessao, isLoading: ls } = useQuery({
    queryKey: ["sessao-detalhe", sessaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessoes_prova")
        .select(`
          id, estudante_id, simulado_id, status, iniciada_em, finalizada_em,
          total_questoes, acertos, pontuacao, ordem_questoes,
          estudantes:estudante_id ( id, email, nome ),
          simulados:simulado_id ( id, titulo, duracao_minutos )
        `)
        .eq("id", sessaoId)
        .single();
      if (error) throw error;
      return data as unknown as Sessao;
    },
  });

  const { data: sessoesEstudante = [] } = useQuery({
    queryKey: ["sessoes-do-estudante", sessao?.estudante_id],
    enabled: !!sessao?.estudante_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessoes_prova")
        .select(`id, status, iniciada_em, finalizada_em, pontuacao, simulados:simulado_id ( titulo )`)
        .eq("estudante_id", sessao!.estudante_id)
        .order("iniciada_em", { ascending: false });
      if (error) throw error;
      return data as unknown as Array<{
        id: string; status: string; iniciada_em: string; finalizada_em: string | null;
        pontuacao: number | null; simulados: { titulo: string } | null;
      }>;
    },
  });


  const { data: respostas = [] } = useQuery({
    queryKey: ["sessao-respostas", sessaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("respostas")
        .select("id, questao_id, alternativa_id, correta, tempo_gasto_segundos, marcada_em")
        .eq("sessao_id", sessaoId);
      if (error) throw error;
      return data as Resposta[];
    },
  });

  const questaoIds = Array.isArray(sessao?.ordem_questoes)
    ? (sessao!.ordem_questoes as string[])
    : respostas.map((r) => r.questao_id);

  const { data: questoes = [] } = useQuery({
    queryKey: ["sessao-questoes", questaoIds.join(",")],
    enabled: questaoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questoes")
        .select(`
          id, enunciado, disciplina, topico, explicacao,
          alternativas ( id, letra, texto, correta )
        `)
        .in("id", questaoIds);
      if (error) throw error;
      const qs = (data ?? []) as unknown as Questao[];
      for (const q of qs) {
        q.alternativas = [...q.alternativas].sort((a, b) => a.letra.localeCompare(b.letra));
      }
      return qs;
    },
  });

  const respPorQ = new Map(respostas.map((r) => [r.questao_id, r]));
  const ordered = questaoIds
    .map((id) => questoes.find((q) => q.id === id))
    .filter((q): q is Questao => !!q);

  const total = ordered.length;
  const corretas = respostas.filter((r) => r.correta === true).length;
  const incorretas = respostas.filter((r) => r.correta === false).length;
  // Visualizadas mas deixadas em branco: existe resposta com alternativa nula
  // (a página da sessão grava após 15s vendo a questão).
  const visualizadasBranco = respostas.filter(
    (r) => r.alternativa_id === null,
  ).length;
  // Não visualizadas: não há nenhum registro de resposta para a questão
  const naoVisualizadas = ordered.filter((q) => !respPorQ.has(q.id)).length;
  const acerto = total ? (corretas / total) * 100 : 0;
  const somaTempos = respostas.reduce((a, r) => a + (r.tempo_gasto_segundos ?? 0), 0);
  const tempoVisualizadoBranco = respostas
    .filter((r) => r.alternativa_id === null)
    .reduce((a, r) => a + (r.tempo_gasto_segundos ?? 0), 0);
  const duracaoSessao = sessao?.finalizada_em
    ? Math.max(0, Math.floor(
        (new Date(sessao.finalizada_em).getTime() - new Date(sessao.iniciada_em).getTime()) / 1000,
      ))
    : 0;
  const tempoTotal = duracaoSessao > 0 ? duracaoSessao : somaTempos;

  function exportar() {
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["#", "Questão", "Disciplina", "Resposta", "Correta", "Resultado", "Tempo (s)"];
    const rows = ordered.map((q, i) => {
      const r = respPorQ.get(q.id);
      const certa = q.alternativas.find((a) => a.correta);
      const escolhida = q.alternativas.find((a) => a.id === r?.alternativa_id);
      const result =
        !r ? "Não visualizada" :
        r.alternativa_id === null ? "Visualizada em branco" :
        r.correta ? "Correta" : "Incorreta";
      return [
        i + 1, q.enunciado.slice(0, 200), q.disciplina ?? "",
        escolhida?.letra ?? "—", certa?.letra ?? "—", result,
        r?.tempo_gasto_segundos ?? "",
      ];
    });
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sessao-${sessaoId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (ls || !sessao) {
    return <div className="p-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/respostas">
            <ArrowLeft size={14} className="mr-1" /> Voltar para respostas
          </Link>
        </Button>
        <Button onClick={exportar} variant="outline" size="sm">
          <Download size={14} className="mr-1" /> Exportar sessão (CSV)
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{sessao.simulados?.titulo}</CardTitle>
          <div className="text-sm text-muted-foreground">
            <Link
              to="/admin/estudantes/$id"
              params={{ id: sessao.estudante_id }}
              className="hover:underline font-medium text-foreground"
            >
              {sessao.estudantes?.nome ?? sessao.estudantes?.email}
            </Link>
            {" · "}{sessao.estudantes?.email}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <Info label="Status" value={<Badge variant="outline">{sessao.status}</Badge>} />
            <Info label="Iniciada" value={formatBrasilia(sessao.iniciada_em, "dd/MM/yyyy HH:mm")} />
            <Info
              label="Finalizada"
              value={sessao.finalizada_em ? formatBrasilia(sessao.finalizada_em, "dd/MM/yyyy HH:mm") : "—"}
            />
            <Info
              label="Pontuação"
              value={sessao.pontuacao != null ? Number(sessao.pontuacao).toFixed(2) : "—"}
            />
            <Info label="Acerto" value={`${acerto.toFixed(1)}%`} />
          </div>
        </CardContent>
      </Card>

      {sessoesEstudante.length > 1 && (
        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="text-sm font-medium shrink-0">
              Sessões deste estudante ({sessoesEstudante.length}):
            </div>
            <Select
              value={sessaoId}
              onValueChange={(v) =>
                navigate({
                  to: "/admin/respostas/sessao/$sessaoId",
                  params: { sessaoId: v },
                })
              }
            >
              <SelectTrigger className="h-9 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessoesEstudante.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.simulados?.titulo ?? "—"} ·{" "}
                    {formatBrasilia(s.iniciada_em, "dd/MM/yyyy HH:mm")} · {s.status}
                    {s.pontuacao != null ? ` · ${Number(s.pontuacao).toFixed(1)}pt` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Corretas" value={corretas} tone="success" icon={<CheckCircle2 size={14} />} />
        <Kpi label="Incorretas" value={incorretas} tone="danger" icon={<XCircle size={14} />} />
        <Kpi
          label="Visualizadas em branco"
          value={visualizadasBranco}
          tone="warn"
          icon={<Eye size={14} />}
          hint={
            tempoVisualizadoBranco > 0
              ? `${formatDuration(tempoVisualizadoBranco)} de tempo`
              : undefined
          }
        />
        <Kpi
          label="Não visualizadas"
          value={naoVisualizadas}
          tone="muted"
          icon={<EyeOff size={14} />}
        />
        <Kpi label="Tempo total" value={formatDuration(tempoTotal)} tone="muted" icon={<Clock size={14} />} />
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        “Visualizadas em branco” são questões que o estudante abriu por mais de 15s
        e seguiu adiante sem marcar resposta. “Não visualizadas” são questões que
        ele nunca chegou a abrir antes de finalizar/expirar a sessão.
      </p>


      <div className="space-y-4">
        {ordered.map((q, i) => {
          const r = respPorQ.get(q.id);
          return (
            <Card key={q.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono">Q{i + 1}</Badge>
                      {q.disciplina && (
                        <Badge variant="secondary" className="text-[10px]">{q.disciplina}</Badge>
                      )}
                      {q.topico && (
                        <Badge variant="outline" className="text-[10px]">{q.topico}</Badge>
                      )}
                      <ResultadoBadge r={r} />
                      {r?.tempo_gasto_segundos != null && (
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Clock size={11} /> {r.tempo_gasto_segundos}s
                        </span>
                      )}
                    </div>
                    <Markdown className="text-sm font-medium">{q.enunciado}</Markdown>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {q.alternativas.map((a) => {
                  const isMarcada = r?.alternativa_id === a.id;
                  const isCorreta = a.correta;
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-md border text-sm",
                        isCorreta && "border-emerald-500/40 bg-emerald-500/5",
                        isMarcada && !isCorreta && "border-destructive/40 bg-destructive/5",
                        !isMarcada && !isCorreta && "border-border",
                      )}
                    >
                      <span className="font-mono font-bold w-6 shrink-0">{a.letra}</span>
                      <Markdown className="flex-1 text-sm">{a.texto}</Markdown>
                      <div className="flex gap-1 shrink-0">
                        {isMarcada && (
                          <Badge variant="outline" className="text-[10px]">Marcada</Badge>
                        )}
                        {isCorreta && (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">
                            Gabarito
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                {q.explicacao && (
                  <div className="p-3 bg-muted rounded-md mt-2">
                    <p className="text-xs font-semibold text-foreground mb-1">Explicação</p>
                    <Markdown className="text-xs text-muted-foreground">{q.explicacao}</Markdown>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ResultadoBadge({ r }: { r: Resposta | undefined }) {
  if (!r) {
    return (
      <Badge variant="outline" className="text-muted-foreground text-[10px]">
        <EyeOff size={10} className="mr-1" /> Não visualizada
      </Badge>
    );
  }
  if (r.alternativa_id === null) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10"
      >
        <Eye size={10} className="mr-1" /> Visualizada em branco
      </Badge>
    );
  }
  if (r.correta)
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">
        <CheckCircle2 size={10} className="mr-1" /> Correta
      </Badge>
    );
  return (
    <Badge variant="destructive" className="text-[10px]">
      <XCircle size={10} className="mr-1" /> Incorreta
    </Badge>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Kpi({
  label, value, tone, icon, hint,
}: {
  label: string; value: number | string;
  tone: "success" | "danger" | "muted" | "warn";
  icon: React.ReactNode;
  hint?: string;
}) {
  const cls = {
    success: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
    danger: "text-destructive bg-destructive/10",
    warn: "text-amber-700 dark:text-amber-300 bg-amber-500/10",
    muted: "text-muted-foreground bg-muted",
  }[tone];
  return (
    <div className={cn("p-3 rounded-md flex items-center gap-3", cls)}>
      {icon}
      <div>
        <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-[10px] opacity-70">{hint}</p>}
      </div>
    </div>
  );
}
