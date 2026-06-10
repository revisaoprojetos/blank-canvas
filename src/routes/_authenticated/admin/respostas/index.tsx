import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { Toaster } from "@/components/ui/sonner";
import {
  BarChart3, Search, Download, CheckCircle2, XCircle, MinusCircle, Users,
  FileBarChart, Target, Percent, Eye,
} from "lucide-react";
import { formatBrasilia } from "@/lib/datetime";
import { DataPagination, useStickyState } from "@/components/ui/data-pagination";

export const Route = createFileRoute("/_authenticated/admin/respostas/")({
  head: () => ({ meta: [{ title: "Respostas e Desempenho — Painel Admin" }] }),
  component: RespostasPage,
});

type SessaoRow = {
  id: string;
  estudante_id: string;
  simulado_id: string;
  status: string;
  iniciada_em: string;
  finalizada_em: string | null;
  total_questoes: number | null;
  acertos: number | null;
  pontuacao: number | null;
  estudantes: { id: string; email: string; nome: string | null } | null;
  simulados: { id: string; titulo: string } | null;
};

type RespostaRow = {
  id: string;
  sessao_id: string;
  questao_id: string;
  alternativa_id: string | null;
  correta: boolean | null;
  marcada_em: string;
  tempo_gasto_segundos: number | null;
  questoes: { enunciado: string; disciplina: string | null; topico: string | null } | null;
  alternativas: { letra: string; texto: string } | null;
};

type Grupo = { id: string; nome: string };
type Simulado = { id: string; titulo: string };

function RespostasPage() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <Toaster />
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <BarChart3 size={28} /> Respostas e Desempenho
        </h1>
        <p className="text-muted-foreground mt-1">
          Analise as respostas dos estudantes e exporte relatórios com filtros.
        </p>
      </header>
      <Content />
    </div>
  );
}

function Content() {
  const [tab, setTab] = useStickyState<string>("resp:tab", "estudantes");

  const [fSimulado, setFSimulado] = useStickyState<string>("resp:fSim", "__all__");
  const [fGrupo, setFGrupo] = useStickyState<string>("resp:fGrupo", "__all__");
  const [fStatus, setFStatus] = useStickyState<string>("resp:fStatus", "__all__");
  const [fResultado, setFResultado] = useStickyState<string>("resp:fRes", "__all__");
  const [busca, setBusca] = useStickyState<string>("resp:busca", "");
  const [dataIni, setDataIni] = useStickyState<string>("resp:di", "");
  const [dataFim, setDataFim] = useStickyState<string>("resp:df", "");

  const { data: simulados = [] } = useQuery({
    queryKey: ["resp-simulados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulados").select("id, titulo").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Simulado[];
    },
  });

  const { data: grupos = [] } = useQuery({
    queryKey: ["resp-grupos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupos").select("id, nome").eq("arquivado", false).order("nome");
      if (error) throw error;
      return data as Grupo[];
    },
  });

  const { data: membros = [] } = useQuery({
    queryKey: ["resp-grupo-membros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_membros").select("estudante_id, grupo_id");
      if (error) throw error;
      return data as { estudante_id: string; grupo_id: string }[];
    },
  });

  const { data: sessoes = [], isLoading: loadingSess } = useQuery({
    queryKey: ["resp-sessoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessoes_prova")
        .select(`
          id, estudante_id, simulado_id, status, iniciada_em, finalizada_em,
          total_questoes, acertos, pontuacao,
          estudantes:estudante_id ( id, email, nome ),
          simulados:simulado_id ( id, titulo )
        `)
        .order("iniciada_em", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as SessaoRow[];
    },
  });

  const sessoesEstudantesPorGrupo = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const x of membros) {
      const s = m.get(x.grupo_id) ?? new Set<string>();
      s.add(x.estudante_id);
      m.set(x.grupo_id, s);
    }
    return m;
  }, [membros]);

  const sessoesFiltradas = useMemo(() => {
    const s = busca.trim().toLowerCase();
    const di = dataIni ? new Date(dataIni).getTime() : null;
    const df = dataFim ? new Date(dataFim).getTime() + 24 * 3600 * 1000 : null;
    const grupoSet = fGrupo !== "__all__" ? sessoesEstudantesPorGrupo.get(fGrupo) : null;

    return sessoes.filter((x) => {
      if (fSimulado !== "__all__" && x.simulado_id !== fSimulado) return false;
      if (fStatus !== "__all__" && x.status !== fStatus) return false;
      if (grupoSet && !grupoSet.has(x.estudante_id)) return false;
      const t = new Date(x.iniciada_em).getTime();
      if (di && t < di) return false;
      if (df && t > df) return false;
      if (s) {
        const est = x.estudantes;
        const hay = `${est?.email ?? ""} ${est?.nome ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [sessoes, busca, fSimulado, fStatus, fGrupo, dataIni, dataFim, sessoesEstudantesPorGrupo]);

  const sessaoIds = useMemo(() => sessoesFiltradas.map((s) => s.id), [sessoesFiltradas]);

  const { data: respostas = [], isLoading: loadingResp } = useQuery({
    queryKey: ["resp-respostas", sessaoIds.slice(0, 200).join(",")],
    enabled: sessaoIds.length > 0,
    queryFn: async () => {
      // Chunk to avoid URL too long
      const chunks: string[][] = [];
      for (let i = 0; i < sessaoIds.length; i += 200) chunks.push(sessaoIds.slice(i, i + 200));
      const all: RespostaRow[] = [];
      for (const ch of chunks) {
        const { data, error } = await supabase
          .from("respostas")
          .select(`
            id, sessao_id, questao_id, alternativa_id, correta, marcada_em, tempo_gasto_segundos,
            questoes:questao_id ( enunciado, disciplina, topico ),
            alternativas:alternativa_id ( letra, texto )
          `)
          .in("sessao_id", ch);
        if (error) throw error;
        all.push(...((data ?? []) as unknown as RespostaRow[]));
      }
      return all;
    },
  });

  const respostasFiltradas = useMemo(() => {
    return respostas.filter((r) => {
      if (fResultado === "corretas" && r.correta !== true) return false;
      if (fResultado === "incorretas" && r.correta !== false) return false;
      if (fResultado === "branco" && r.alternativa_id !== null) return false;
      return true;
    });
  }, [respostas, fResultado]);

  // Aggregate per student
  type Agregado = {
    estudante_id: string;
    nome: string;
    email: string;
    sessoes: number;
    finalizadas: number;
    total_respondidas: number;
    corretas: number;
    incorretas: number;
    em_branco: number;
    tempo_total_s: number;
    pontuacao_media: number | null;
    ultimo_acesso: string | null;
    simulados: Set<string>;
  };

  const agregados = useMemo(() => {
    const map = new Map<string, Agregado>();
    const respPorSessao = new Map<string, RespostaRow[]>();
    for (const r of respostasFiltradas) {
      const arr = respPorSessao.get(r.sessao_id) ?? [];
      arr.push(r);
      respPorSessao.set(r.sessao_id, arr);
    }

    for (const s of sessoesFiltradas) {
      const est = s.estudantes;
      if (!est) continue;
      const cur = map.get(est.id) ?? {
        estudante_id: est.id,
        nome: est.nome ?? est.email,
        email: est.email,
        sessoes: 0,
        finalizadas: 0,
        total_respondidas: 0,
        corretas: 0,
        incorretas: 0,
        em_branco: 0,
        tempo_total_s: 0,
        pontuacao_media: null,
        ultimo_acesso: null,
        simulados: new Set<string>(),
      };
      cur.sessoes += 1;
      if (s.status === "finalizada") cur.finalizadas += 1;
      cur.simulados.add(s.simulado_id);
      if (!cur.ultimo_acesso || cur.ultimo_acesso < s.iniciada_em) cur.ultimo_acesso = s.iniciada_em;

      // Tempo da sessão: usa duração real (finalizada - iniciada) quando disponível
      if (s.finalizada_em) {
        const dur = Math.max(
          0,
          Math.floor(
            (new Date(s.finalizada_em).getTime() - new Date(s.iniciada_em).getTime()) / 1000,
          ),
        );
        cur.tempo_total_s += dur;
      }

      const rs = respPorSessao.get(s.id) ?? [];
      for (const r of rs) {
        cur.total_respondidas += 1;
        if (r.alternativa_id === null) cur.em_branco += 1;
        else if (r.correta === true) cur.corretas += 1;
        else if (r.correta === false) cur.incorretas += 1;
      }

      const pontuacoes = sessoesFiltradas
        .filter((x) => x.estudante_id === est.id && x.pontuacao != null)
        .map((x) => Number(x.pontuacao));
      cur.pontuacao_media = pontuacoes.length
        ? pontuacoes.reduce((a, b) => a + b, 0) / pontuacoes.length
        : null;

      map.set(est.id, cur);
    }
    return Array.from(map.values()).sort((a, b) => {
      const ra = a.total_respondidas ? a.corretas / a.total_respondidas : 0;
      const rb = b.total_respondidas ? b.corretas / b.total_respondidas : 0;
      return rb - ra;
    });
  }, [sessoesFiltradas, respostasFiltradas]);

  const aggBuscado = useMemo(() => {
    const s = busca.trim().toLowerCase();
    if (!s) return agregados;
    return agregados.filter((a) =>
      a.nome.toLowerCase().includes(s) || a.email.toLowerCase().includes(s),
    );
  }, [agregados, busca]);

  const kpis = useMemo(() => {
    const totalResp = respostasFiltradas.length;
    const corretas = respostasFiltradas.filter((r) => r.correta === true).length;
    const acerto = totalResp ? (corretas / totalResp) * 100 : 0;
    return {
      estudantes: agregados.length,
      sessoes: sessoesFiltradas.length,
      respostas: totalResp,
      acerto,
    };
  }, [agregados, sessoesFiltradas, respostasFiltradas]);

  function exportar(rows: string[][], filename: string) {
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarDesempenho() {
    const header = [
      "Nome", "E-mail", "Sessões", "Finalizadas", "Simulados",
      "Respondidas", "Corretas", "Incorretas", "Em branco",
      "% Acerto", "Pontuação média", "Tempo total (min)", "Último acesso",
    ];
    const rows = aggBuscado.map((a) => [
      a.nome, a.email, a.sessoes, a.finalizadas, a.simulados.size,
      a.total_respondidas, a.corretas, a.incorretas, a.em_branco,
      a.total_respondidas ? ((a.corretas / a.total_respondidas) * 100).toFixed(1) : "0.0",
      a.pontuacao_media != null ? a.pontuacao_media.toFixed(2) : "",
      (a.tempo_total_s / 60).toFixed(1),
      a.ultimo_acesso ? formatBrasilia(a.ultimo_acesso, "dd/MM/yyyy HH:mm") : "",
    ]);
    exportar([header, ...rows.map((r) => r.map(String))], `desempenho-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportarRespostas() {
    const sessoesMap = new Map(sessoesFiltradas.map((s) => [s.id, s]));
    const header = [
      "Estudante", "E-mail", "Simulado", "Data sessão", "Questão",
      "Disciplina", "Tópico", "Alternativa", "Resultado", "Tempo (s)", "Marcada em",
    ];
    const rows = respostasFiltradas.map((r) => {
      const s = sessoesMap.get(r.sessao_id);
      const resultado =
        r.alternativa_id === null ? "Em branco" :
        r.correta === true ? "Correta" :
        r.correta === false ? "Incorreta" : "—";
      return [
        s?.estudantes?.nome ?? "", s?.estudantes?.email ?? "",
        s?.simulados?.titulo ?? "",
        s ? formatBrasilia(s.iniciada_em, "dd/MM/yyyy HH:mm") : "",
        (r.questoes?.enunciado ?? "").slice(0, 200),
        r.questoes?.disciplina ?? "", r.questoes?.topico ?? "",
        r.alternativas?.letra ?? "—", resultado,
        r.tempo_gasto_segundos ?? "",
        formatBrasilia(r.marcada_em, "dd/MM/yyyy HH:mm:ss"),
      ];
    });
    exportar([header, ...rows.map((r) => r.map(String))], `respostas-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Estudantes" value={kpis.estudantes} icon={<Users size={16} />} tone="primary" />
        <Kpi label="Sessões" value={kpis.sessoes} icon={<FileBarChart size={16} />} tone="muted" />
        <Kpi label="Respostas" value={kpis.respostas} icon={<Target size={16} />} tone="muted" />
        <Kpi label="% Acerto geral" value={`${kpis.acerto.toFixed(1)}%`} icon={<Percent size={16} />} tone="success" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <Select value={fSimulado} onValueChange={setFSimulado}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Simulado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os simulados</SelectItem>
                {simulados.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fGrupo} onValueChange={setFGrupo}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Grupo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os grupos</SelectItem>
                {grupos.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Status da sessão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os status</SelectItem>
                <SelectItem value="ativa">Em andamento</SelectItem>
                <SelectItem value="finalizada">Finalizada</SelectItem>
                <SelectItem value="expirada">Expirada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="h-9" />
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <TabsList>
            <TabsTrigger value="estudantes">Desempenho por estudante</TabsTrigger>
            <TabsTrigger value="respostas">Respostas detalhadas</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {tab === "respostas" && (
              <Select value={fResultado} onValueChange={setFResultado}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os resultados</SelectItem>
                  <SelectItem value="corretas">Apenas corretas</SelectItem>
                  <SelectItem value="incorretas">Apenas incorretas</SelectItem>
                  <SelectItem value="branco">Em branco</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={tab === "estudantes" ? exportarDesempenho : exportarRespostas}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Download size={14} className="mr-1" /> Exportar CSV
            </Button>
          </div>
        </div>

        <TabsContent value="estudantes">
          <TabelaEstudantes
            rows={aggBuscado}
            sessoes={sessoesFiltradas}
            loading={loadingSess || loadingResp}
          />
        </TabsContent>

        <TabsContent value="respostas">
          <TabelaRespostas
            respostas={respostasFiltradas}
            sessoes={sessoesFiltradas}
            loading={loadingSess || loadingResp}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabelaEstudantes({
  rows, sessoes, loading,
}: {
  rows: Array<{
    estudante_id: string; nome: string; email: string;
    sessoes: number; finalizadas: number;
    total_respondidas: number; corretas: number; incorretas: number; em_branco: number;
    tempo_total_s: number; pontuacao_media: number | null; ultimo_acesso: string | null;
    simulados: Set<string>;
  }>;
  sessoes: SessaoRow[];
  loading: boolean;
}) {
  const [page, setPage] = useStickyState<number>("resp:estPage", 1);
  const [pageSize, setPageSize] = useStickyState<number>("resp:estSize", 20);

  const sessoesPorEst = useMemo(() => {
    const m = new Map<string, SessaoRow[]>();
    for (const s of sessoes) {
      const arr = m.get(s.estudante_id) ?? [];
      arr.push(s);
      m.set(s.estudante_id, arr);
    }
    return m;
  }, [sessoes]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(page, totalPages);
  const paged = rows.slice((safe - 1) * pageSize, safe * pageSize);

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <p className="p-8 text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-sm text-muted-foreground text-center">
            Nenhum dado para os filtros selecionados.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudante</TableHead>
                  <TableHead className="text-right">Sessões</TableHead>
                  <TableHead className="text-right">Simulados</TableHead>
                  <TableHead className="text-right">Respondidas</TableHead>
                  <TableHead className="text-right">Corretas</TableHead>
                  <TableHead className="text-right">Incorretas</TableHead>
                  <TableHead className="text-right">Em branco</TableHead>
                  <TableHead className="text-right">% Acerto</TableHead>
                  <TableHead className="text-right">Pont. média</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((a) => {
                  const pct = a.total_respondidas
                    ? (a.corretas / a.total_respondidas) * 100 : 0;
                  const estSessoes = sessoesPorEst.get(a.estudante_id) ?? [];
                  return (
                    <TableRow key={a.estudante_id}>
                      <TableCell>
                        <div className="font-medium">{a.nome}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.sessoes} <span className="text-xs text-muted-foreground">({a.finalizadas} fin.)</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.simulados.size}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.total_respondidas}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">{a.corretas}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{a.incorretas}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{a.em_branco}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={pct >= 70 ? "default" : pct >= 50 ? "secondary" : "outline"}>
                          {pct.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.pontuacao_media != null ? a.pontuacao_media.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {(a.tempo_total_s / 60).toFixed(0)}min
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.ultimo_acesso ? formatBrasilia(a.ultimo_acesso, "dd/MM/yyyy HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {estSessoes.length > 0 ? (
                          <Button asChild size="sm" variant="ghost" title={`Ver respostas (${estSessoes.length} sessão(ões))`}>
                            <Link
                              to="/admin/respostas/sessao/$sessaoId"
                              params={{ sessaoId: estSessoes[0].id }}
                            >
                              <Eye size={14} className="mr-1" /> Ver respostas
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <DataPagination
              page={safe} pageSize={pageSize} total={rows.length}
              onPage={setPage} onPageSize={setPageSize} itemLabel="estudantes"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}


function TabelaRespostas({
  respostas, sessoes, loading,
}: {
  respostas: RespostaRow[]; sessoes: SessaoRow[]; loading: boolean;
}) {
  const [page, setPage] = useStickyState<number>("resp:rPage", 1);
  const [pageSize, setPageSize] = useStickyState<number>("resp:rSize", 30);
  const sessoesMap = useMemo(
    () => new Map(sessoes.map((s) => [s.id, s])),
    [sessoes],
  );
  const totalPages = Math.max(1, Math.ceil(respostas.length / pageSize));
  const safe = Math.min(page, totalPages);
  const paged = respostas.slice((safe - 1) * pageSize, safe * pageSize);

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <p className="p-8 text-sm text-muted-foreground">Carregando...</p>
        ) : respostas.length === 0 ? (
          <p className="p-8 text-sm text-muted-foreground text-center">
            Nenhuma resposta para os filtros selecionados.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudante</TableHead>
                  <TableHead>Simulado</TableHead>
                  <TableHead>Questão</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead className="text-center">Resposta</TableHead>
                  <TableHead className="text-center">Resultado</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead>Marcada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r) => {
                  const s = sessoesMap.get(r.sessao_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{s?.estudantes?.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{s?.estudantes?.email}</div>
                      </TableCell>
                      <TableCell className="text-xs">{s?.simulados?.titulo ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-md truncate" title={r.questoes?.enunciado ?? ""}>
                        {(r.questoes?.enunciado ?? "").slice(0, 100)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.questoes?.disciplina ?? "—"}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {r.alternativas?.letra ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <ResultadoBadge r={r} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {r.tempo_gasto_segundos ? `${r.tempo_gasto_segundos}s` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatBrasilia(r.marcada_em, "dd/MM HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost" title="Ver sessão">
                          <Link
                            to="/admin/respostas/sessao/$sessaoId"
                            params={{ sessaoId: r.sessao_id }}
                          >
                            <Eye size={14} />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <DataPagination
              page={safe} pageSize={pageSize} total={respostas.length}
              onPage={setPage} onPageSize={setPageSize} itemLabel="respostas"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ResultadoBadge({ r }: { r: RespostaRow }) {
  if (r.alternativa_id === null)
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <MinusCircle size={12} className="mr-1" /> Em branco
      </Badge>
    );
  if (r.correta === true)
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 size={12} className="mr-1" /> Correta
      </Badge>
    );
  if (r.correta === false)
    return (
      <Badge variant="destructive">
        <XCircle size={12} className="mr-1" /> Incorreta
      </Badge>
    );
  return <Badge variant="outline">—</Badge>;
}

function Kpi({
  label, value, icon, tone,
}: {
  label: string; value: number | string; icon: React.ReactNode;
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
      <CardContent><div className="text-3xl font-bold">{value}</div></CardContent>
    </Card>
  );
}
