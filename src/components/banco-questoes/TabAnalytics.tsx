import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, CartesianGrid, Legend, LineChart, Line,
} from "recharts";
import {
  Activity, TrendingDown, TrendingUp, AlertTriangle, Target, Layers, Clock,
} from "lucide-react";
import { stripMarkdown } from "@/components/ui/markdown";
import { format } from "date-fns";

type Questao = {
  id: string;
  enunciado: string;
  area: string | null;
  disciplina: string | null;
  assunto: string | null;
  topico: string | null;
  dificuldade: number | null;
  status: "ativa" | "em_revisao" | "arquivada";
};

type Resposta = {
  questao_id: string;
  correta: boolean | null;
  tempo_gasto_segundos: number | null;
  marcada_em: string;
};

type PastaRow = { id: string; nome: string };
type Vinc = { questao_id: string; pasta_id: string };

const COLORS_STATUS: Record<string, string> = {
  ativa: "hsl(142 71% 45%)",
  em_revisao: "hsl(38 92% 50%)",
  arquivada: "hsl(220 9% 46%)",
};
const COLORS_DIF = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#7c3aed"];

export function TabAnalytics() {
  const [fPasta, setFPasta] = useState<string>("__all__");
  const [fQuestao, setFQuestao] = useState<string>("__all__");

  const { data: questoes = [], isLoading: lQ } = useQuery({
    queryKey: ["analytics-questoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questoes")
        .select("id, enunciado, area, disciplina, assunto, topico, dificuldade, status")
        .limit(5000);
      if (error) throw error;
      return data as Questao[];
    },
  });

  const { data: respostas = [], isLoading: lR } = useQuery({
    queryKey: ["analytics-respostas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("respostas")
        .select("questao_id, correta, tempo_gasto_segundos, marcada_em")
        .limit(50000);
      if (error) throw error;
      return data as Resposta[];
    },
  });

  const { data: pastas = [] } = useQuery({
    queryKey: ["analytics-pastas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pastas").select("id, nome").order("nome");
      if (error) throw error;
      return data as PastaRow[];
    },
  });

  const { data: vincs = [] } = useQuery({
    queryKey: ["analytics-vincs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("questao_pasta").select("questao_id, pasta_id");
      if (error) throw error;
      return data as Vinc[];
    },
  });

  // questoes filtradas pelo escopo de pasta
  const questoesEscopo = useMemo(() => {
    if (fPasta === "__all__") return questoes;
    const ids = new Set(vincs.filter((v) => v.pasta_id === fPasta).map((v) => v.questao_id));
    return questoes.filter((q) => ids.has(q.id));
  }, [questoes, vincs, fPasta]);

  const opcoesQuestoes = useMemo(
    () =>
      questoesEscopo
        .slice(0, 500)
        .map((q) => ({ id: q.id, label: `${stripMarkdown(q.enunciado).slice(0, 60)}…` })),
    [questoesEscopo]
  );

  // Se questão específica selecionada, restringimos a essa
  const questaoSelecionada = useMemo(
    () => (fQuestao !== "__all__" ? questoes.find((q) => q.id === fQuestao) ?? null : null),
    [questoes, fQuestao]
  );

  const respostasEscopo = useMemo(() => {
    const qIds = new Set(questoesEscopo.map((q) => q.id));
    return respostas.filter((r) => {
      if (!qIds.has(r.questao_id)) return false;
      if (fQuestao !== "__all__" && r.questao_id !== fQuestao) return false;
      return true;
    });
  }, [respostas, questoesEscopo, fQuestao]);

  /* --- Cálculos --- */
  const stats = useMemo(() => {
    type Agg = { total: number; acertos: number; tempoTotal: number; tempoN: number };
    const porQuestao = new Map<string, Agg>();
    for (const r of respostasEscopo) {
      const a = porQuestao.get(r.questao_id) ?? { total: 0, acertos: 0, tempoTotal: 0, tempoN: 0 };
      a.total++;
      if (r.correta) a.acertos++;
      if (r.tempo_gasto_segundos != null) { a.tempoTotal += r.tempo_gasto_segundos; a.tempoN++; }
      porQuestao.set(r.questao_id, a);
    }
    const totalResp = respostasEscopo.length;
    const totalAcertos = respostasEscopo.filter((r) => r.correta).length;
    const taxaGlobal = totalResp > 0 ? (totalAcertos / totalResp) * 100 : 0;
    const tempoMedioGlobal = (() => {
      const ts = respostasEscopo.filter((r) => r.tempo_gasto_segundos != null);
      if (ts.length === 0) return 0;
      return ts.reduce((a, r) => a + (r.tempo_gasto_segundos ?? 0), 0) / ts.length;
    })();

    const qById = new Map(questoesEscopo.map((q) => [q.id, q]));
    const ranking = Array.from(porQuestao.entries())
      .filter(([, a]) => a.total >= (fQuestao !== "__all__" ? 1 : 5))
      .map(([id, a]) => ({
        id,
        questao: qById.get(id),
        total: a.total,
        taxa: (a.acertos / a.total) * 100,
      }))
      .filter((r) => r.questao);

    const piores = [...ranking].sort((a, b) => a.taxa - b.taxa).slice(0, 10);
    const melhores = [...ranking].sort((a, b) => b.taxa - a.taxa).slice(0, 10);

    return {
      totalResp, totalAcertos, taxaGlobal, tempoMedioGlobal,
      questoesRespondidas: porQuestao.size,
      piores, melhores, porQuestao,
    };
  }, [respostasEscopo, questoesEscopo, fQuestao]);

  const porDisciplina = useMemo(() => {
    type X = { disciplina: string; total: number; respostas: number; acertos: number };
    const m = new Map<string, X>();
    for (const q of questoesEscopo) {
      const k = q.disciplina ?? "(sem disciplina)";
      const x = m.get(k) ?? { disciplina: k, total: 0, respostas: 0, acertos: 0 };
      x.total++;
      m.set(k, x);
    }
    const qById = new Map(questoesEscopo.map((q) => [q.id, q]));
    for (const r of respostasEscopo) {
      const q = qById.get(r.questao_id);
      if (!q) continue;
      const k = q.disciplina ?? "(sem disciplina)";
      const x = m.get(k);
      if (!x) continue;
      x.respostas++;
      if (r.correta) x.acertos++;
    }
    return Array.from(m.values())
      .map((x) => ({ ...x, taxa: x.respostas > 0 ? (x.acertos / x.respostas) * 100 : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [questoesEscopo, respostasEscopo]);

  const porDificuldade = useMemo(() => {
    const m = new Map<number, number>();
    for (const q of questoesEscopo) {
      const d = q.dificuldade ?? 0;
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .filter(([d]) => d > 0)
      .sort(([a], [b]) => a - b)
      .map(([d, total]) => ({ nivel: `Nível ${d}`, total, fill: COLORS_DIF[d - 1] ?? "#888" }));
  }, [questoesEscopo]);

  const porStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of questoesEscopo) m.set(q.status, (m.get(q.status) ?? 0) + 1);
    return Array.from(m.entries()).map(([status, total]) => ({
      name: status === "ativa" ? "Ativas" : status === "em_revisao" ? "Em revisão" : "Arquivadas",
      value: total,
      fill: COLORS_STATUS[status] ?? "#888",
    }));
  }, [questoesEscopo]);

  const porPasta = useMemo(() => {
    if (fPasta !== "__all__") return [];
    const m = new Map<string, number>();
    for (const v of vincs) m.set(v.pasta_id, (m.get(v.pasta_id) ?? 0) + 1);
    return pastas
      .map((p) => ({ pasta: p.nome, total: m.get(p.id) ?? 0 }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [pastas, vincs, fPasta]);

  // Evolução histórica (apenas quando questão específica selecionada)
  const evolucao = useMemo(() => {
    if (fQuestao === "__all__") return [];
    const byDay = new Map<string, { total: number; acertos: number }>();
    for (const r of respostasEscopo) {
      const d = format(new Date(r.marcada_em), "dd/MM");
      const x = byDay.get(d) ?? { total: 0, acertos: 0 };
      x.total++;
      if (r.correta) x.acertos++;
      byDay.set(d, x);
    }
    return Array.from(byDay.entries())
      .map(([dia, x]) => ({ dia, taxa: (x.acertos / x.total) * 100, total: x.total }))
      .slice(-30);
  }, [respostasEscopo, fQuestao]);

  if (lQ || lR) {
    return <p className="text-sm text-muted-foreground p-8 text-center">Carregando analytics...</p>;
  }

  const tempoMedioStr = stats.tempoMedioGlobal > 0
    ? `${Math.round(stats.tempoMedioGlobal)}s`
    : "—";

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Pasta</label>
            <Select value={fPasta} onValueChange={(v) => { setFPasta(v); setFQuestao("__all__"); }}>
              <SelectTrigger><SelectValue placeholder="Todas as pastas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as pastas</SelectItem>
                {pastas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Questão</label>
            <Select value={fQuestao} onValueChange={setFQuestao}>
              <SelectTrigger><SelectValue placeholder="Todas as questões" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as questões</SelectItem>
                {opcoesQuestoes.map((q) => (
                  <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label={questaoSelecionada ? "Respostas (questão)" : "Respostas registradas"}
          value={stats.totalResp.toLocaleString("pt-BR")}
          icon={<Activity size={16} />} tone="primary"
        />
        <Kpi
          label="Taxa de acerto"
          value={`${stats.taxaGlobal.toFixed(1)}%`}
          icon={<Target size={16} />} tone="success"
        />
        <Kpi
          label={questaoSelecionada ? "Erros" : "Questões respondidas"}
          value={
            questaoSelecionada
              ? (stats.totalResp - stats.totalAcertos).toLocaleString("pt-BR")
              : `${stats.questoesRespondidas} / ${questoesEscopo.length}`
          }
          icon={<Layers size={16} />} tone="muted"
        />
        <Kpi
          label={questaoSelecionada ? "Tempo médio" : "Candidatas a revisão"}
          value={
            questaoSelecionada
              ? tempoMedioStr
              : stats.piores.filter((p) => p.taxa < 30).length
          }
          icon={questaoSelecionada ? <Clock size={16} /> : <AlertTriangle size={16} />}
          tone="warn"
        />
      </div>

      {/* Cabeçalho da questão selecionada */}
      {questaoSelecionada && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Questão selecionada</p>
            <p className="text-sm font-medium">{stripMarkdown(questaoSelecionada.enunciado)}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline">{questaoSelecionada.disciplina ?? "—"}</Badge>
              <Badge variant="outline">{questaoSelecionada.assunto ?? questaoSelecionada.topico ?? "—"}</Badge>
              {questaoSelecionada.dificuldade && <Badge variant="outline">N{questaoSelecionada.dificuldade}</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evolução histórica (questão) */}
      {questaoSelecionada && evolucao.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Evolução histórica (taxa de acerto)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="dia" fontSize={11} />
                  <YAxis fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Line type="monotone" dataKey="taxa" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {!questaoSelecionada && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Distribuição por status</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={porStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                        {porStatus.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Distribuição por dificuldade</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porDificuldade}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="nivel" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="total">
                        {porDificuldade.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Desempenho por disciplina</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porDisciplina}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="disciplina" fontSize={11} angle={-15} textAnchor="end" height={60} />
                      <YAxis yAxisId="l" fontSize={12} />
                      <YAxis yAxisId="r" orientation="right" fontSize={12}
                        tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <Tooltip
                        formatter={(value: number, name: string) =>
                          name === "Taxa de acerto" ? `${value.toFixed(1)}%` : value
                        }
                      />
                      <Legend />
                      <Bar yAxisId="l" dataKey="total" name="Qtd. questões" fill="hsl(220 70% 55%)" />
                      <Bar yAxisId="r" dataKey="taxa" name="Taxa de acerto" fill="hsl(142 71% 45%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {porPasta.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Questões por pasta (top 10)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={porPasta} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="pasta" type="category" fontSize={11} width={140} />
                        <Tooltip />
                        <Bar dataKey="total" fill="hsl(280 60% 55%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Pie acertos x erros para questão única */}
        {questaoSelecionada && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Acertos × Erros</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Acertos", value: stats.totalAcertos, fill: "hsl(142 71% 45%)" },
                        { name: "Erros", value: stats.totalResp - stats.totalAcertos, fill: "hsl(0 84% 60%)" },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={90}
                      label
                    />
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rankings — só fazem sentido para pasta / todas */}
      {!questaoSelecionada && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RankingCard
            title="Mais difíceis (menor acerto)"
            icon={<TrendingDown size={16} className="text-destructive" />}
            rows={stats.piores}
            tone="bad"
          />
          <RankingCard
            title="Mais fáceis (maior acerto)"
            icon={<TrendingUp size={16} className="text-emerald-500" />}
            rows={stats.melhores}
            tone="good"
          />
        </div>
      )}
    </div>
  );
}

function Kpi({
  label, value, icon, tone,
}: {
  label: string; value: string | number; icon: React.ReactNode;
  tone: "primary" | "success" | "warn" | "muted";
}) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={`p-2 rounded-md ${toneCls}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function RankingCard({
  title, icon, rows, tone,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { id: string; questao?: Questao; total: number; taxa: number }[];
  tone: "good" | "bad";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">
            Ainda não há respostas suficientes (mínimo 5 por questão).
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Questão</TableHead>
                <TableHead className="w-20 text-right">Resp.</TableHead>
                <TableHead className="w-24 text-right">Acerto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-[280px]">
                    <p className="truncate text-xs">
                      {r.questao ? stripMarkdown(r.questao.enunciado) : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.questao?.disciplina ?? "—"} · {r.questao?.assunto ?? r.questao?.topico ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="text-right text-xs">{r.total}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      className={
                        tone === "bad"
                          ? "bg-destructive/15 text-destructive border-destructive/30"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      }
                    >
                      {r.taxa.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
