import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Plus,
  Upload,
  Download,
  FolderTree,
  Search,
  Eye,
  Pencil,
  FolderPlus,
  FileQuestion,
  CheckCircle2,
  AlertCircle,
  Archive,
  Trash2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { stripMarkdown, Markdown } from "@/components/ui/markdown";
import { formatBrasilia } from "@/lib/datetime";
import { usePastas } from "@/components/pastas/PastasSidebar";
import { TabPastas } from "@/components/banco-questoes/TabPastas";
import { TabAnalytics } from "@/components/banco-questoes/TabAnalytics";
import { AdicionarAoSimuladoPopover } from "@/components/simulados/AdicionarAoSimuladoPopover";
import { DataPagination, useStickyState } from "@/components/ui/data-pagination";

export const Route = createFileRoute("/_authenticated/admin/banco-questoes/")({
  head: () => ({ meta: [{ title: "Banco de Questões — Painel Admin" }] }),
  component: BancoQuestoesPage,
});

type StatusQ = "ativa" | "em_revisao" | "arquivada";

type Questao = {
  id: string;
  codigo_externo: string | null;
  enunciado: string;
  area: string | null;
  disciplina: string | null;
  topico: string | null;
  assunto: string | null;
  dificuldade: number | null;
  status: StatusQ;
  ativa: boolean;
  created_at: string;
};

type QPasta = { questao_id: string; pasta_id: string };

const STATUS_LABEL: Record<StatusQ, string> = {
  ativa: "Ativa",
  em_revisao: "Em revisão",
  arquivada: "Arquivada",
};

function statusBadge(s: StatusQ) {
  if (s === "ativa")
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Ativa</Badge>;
  if (s === "em_revisao")
    return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">Em revisão</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Arquivada</Badge>;
}

function BancoQuestoesPage() {
  const [tab, setTab] = useStickyState<string>("bq:tab", "todas");
  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <Toaster />
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-primary">Banco de Questões</h1>
        <p className="text-muted-foreground mt-1">
          Catálogo centralizado de questões, organização por pastas e análise de desempenho.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="todas">Todas as questões</TabsTrigger>
          <TabsTrigger value="pastas">Pastas</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="todas">
          <TabTodasQuestoes />
        </TabsContent>

        <TabsContent value="pastas">
          <TabPastas />
        </TabsContent>

        <TabsContent value="analytics">
          <TabAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------------- TAB 1 ----------------------------- */

function TabTodasQuestoes() {
  const qc = useQueryClient();
  const [busca, setBusca] = useStickyState<string>("bq:busca", "");
  const [fArea, setFArea] = useStickyState<string>("bq:fArea", "__all__");
  const [fDisc, setFDisc] = useStickyState<string>("bq:fDisc", "__all__");
  const [fAssunto, setFAssunto] = useStickyState<string>("bq:fAssunto", "__all__");
  const [fDif, setFDif] = useStickyState<string>("bq:fDif", "__all__");
  const [fStatus, setFStatus] = useStickyState<string>("bq:fStatus", "__all__");
  const [fPasta, setFPasta] = useStickyState<string>("bq:fPasta", "__all__");
  const [page, setPage] = useStickyState<number>("bq:page", 1);
  const [pageSize, setPageSize] = useStickyState<number>("bq:pageSize", 20);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const { data: questoes = [], isLoading } = useQuery({
    queryKey: ["banco-questoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questoes")
        .select(
          "id, codigo_externo, enunciado, area, disciplina, topico, assunto, dificuldade, status, ativa, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as Questao[];
    },
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["questao-pasta-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questao_pasta")
        .select("questao_id, pasta_id");
      if (error) throw error;
      return data as QPasta[];
    },
  });

  const { data: pastas = [] } = usePastas();

  // map questao_id -> pasta_ids[]
  const pastasPorQuestao = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const v of vinculos) {
      const arr = m.get(v.questao_id) ?? [];
      arr.push(v.pasta_id);
      m.set(v.questao_id, arr);
    }
    return m;
  }, [vinculos]);

  // distinct option lists
  const optsArea = useMemo(
    () => Array.from(new Set(questoes.map((q) => q.area).filter(Boolean) as string[])).sort(),
    [questoes]
  );
  const optsDisc = useMemo(
    () => Array.from(new Set(questoes.map((q) => q.disciplina).filter(Boolean) as string[])).sort(),
    [questoes]
  );
  const optsAssunto = useMemo(
    () =>
      Array.from(
        new Set(
          questoes
            .map((q) => q.assunto ?? q.topico)
            .filter(Boolean) as string[]
        )
      ).sort(),
    [questoes]
  );

  const filtered = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return questoes.filter((q) => {
      if (fArea !== "__all__" && q.area !== fArea) return false;
      if (fDisc !== "__all__" && q.disciplina !== fDisc) return false;
      if (fAssunto !== "__all__" && (q.assunto ?? q.topico) !== fAssunto) return false;
      if (fDif !== "__all__" && String(q.dificuldade ?? 3) !== fDif) return false;
      if (fStatus !== "__all__" && q.status !== fStatus) return false;
      if (fPasta !== "__all__") {
        const ps = pastasPorQuestao.get(q.id) ?? [];
        if (fPasta === "__none__" && ps.length > 0) return false;
        if (fPasta !== "__none__" && !ps.includes(fPasta)) return false;
      }
      if (!s) return true;
      return (
        q.enunciado.toLowerCase().includes(s) ||
        (q.codigo_externo ?? "").toLowerCase().includes(s) ||
        (q.disciplina ?? "").toLowerCase().includes(s) ||
        (q.area ?? "").toLowerCase().includes(s) ||
        (q.topico ?? "").toLowerCase().includes(s) ||
        (q.assunto ?? "").toLowerCase().includes(s)
      );
    });
  }, [questoes, busca, fArea, fDisc, fAssunto, fDif, fStatus, fPasta, pastasPorQuestao]);

  // reset page when filters/search change result set
  const filteredLen = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredLen / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedQuestoes = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  const kpis = useMemo(() => {
    const total = questoes.length;
    let ativas = 0, revisao = 0, arquivadas = 0;
    for (const q of questoes) {
      if (q.status === "ativa") ativas++;
      else if (q.status === "em_revisao") revisao++;
      else arquivadas++;
    }
    return { total, ativas, revisao, arquivadas };
  }, [questoes]);

  function toggle(id: string) {
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selecionadas.size === pagedQuestoes.length && pagedQuestoes.every((x) => selecionadas.has(x.id))) setSelecionadas(new Set());
    else setSelecionadas(new Set(pagedQuestoes.map((x) => x.id)));
  }

  const addPasta = useMutation({
    mutationFn: async ({ ids, pasta_id }: { ids: string[]; pasta_id: string }) => {
      const rows = ids.map((questao_id) => ({ questao_id, pasta_id }));
      const { error } = await supabase
        .from("questao_pasta")
        .upsert(rows, { onConflict: "questao_id,pasta_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`${v.ids.length} questão(ões) adicionada(s) à pasta`);
      setSelecionadas(new Set());
      qc.invalidateQueries({ queryKey: ["questao-pasta-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarPastaEAdd = useMutation({
    mutationFn: async ({ nome, ids }: { nome: string; ids: string[] }) => {
      const { data, error } = await supabase
        .from("pastas")
        .insert({ nome })
        .select("id")
        .single();
      if (error) throw error;
      const rows = ids.map((questao_id) => ({ questao_id, pasta_id: data!.id }));
      const { error: e2 } = await supabase
        .from("questao_pasta")
        .insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Pasta criada e questões adicionadas");
      setSelecionadas(new Set());
      qc.invalidateQueries({ queryKey: ["pastas"] });
      qc.invalidateQueries({ queryKey: ["questao-pasta-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirSelecionadas = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      await supabase.from("alternativas").delete().in("questao_id", ids);
      const { error } = await supabase.from("questoes").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} questão(ões) excluída(s)`);
      setSelecionadas(new Set());
      qc.invalidateQueries({ queryKey: ["banco-questoes"] });
      qc.invalidateQueries({ queryKey: ["questoes"] });
      qc.invalidateQueries({ queryKey: ["questao-pasta-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportarCSV() {
    const cols = ["codigo_externo", "enunciado", "area", "disciplina", "assunto", "topico", "dificuldade", "status", "created_at"];
    const head = cols.join(",");
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = filtered.map((q) =>
      [q.codigo_externo, stripMarkdown(q.enunciado), q.area, q.disciplina, q.assunto, q.topico, q.dificuldade, q.status, q.created_at]
        .map(esc).join(",")
    );
    const blob = new Blob([head + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `banco-questoes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total" value={kpis.total} icon={<FileQuestion size={16} />} tone="primary" />
        <KpiCard label="Ativas" value={kpis.ativas} icon={<CheckCircle2 size={16} />} tone="success" />
        <KpiCard label="Em revisão" value={kpis.revisao} icon={<AlertCircle size={16} />} tone="warn" />
        <KpiCard label="Arquivadas" value={kpis.arquivadas} icon={<Archive size={16} />} tone="muted" />
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/admin/questoes/novo">
            <Plus size={16} className="mr-1" /> Nova questão
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/questoes">
            <Upload size={16} className="mr-1" /> Importar CSV
          </Link>
        </Button>
        <Button variant="outline" onClick={exportarCSV}>
          <Download size={16} className="mr-1" /> Exportar
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/questoes">
            <FolderTree size={16} className="mr-1" /> Organizar em pastas
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, enunciado, área, disciplina, assunto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <FiltroSelect label="Área" value={fArea} onChange={setFArea} options={optsArea} />
            <FiltroSelect label="Disciplina" value={fDisc} onChange={setFDisc} options={optsDisc} />
            <FiltroSelect label="Assunto" value={fAssunto} onChange={setFAssunto} options={optsAssunto} />
            <FiltroSelect
              label="Dificuldade"
              value={fDif}
              onChange={setFDif}
              options={["1", "2", "3", "4", "5"]}
            />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos status</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="em_revisao">Em revisão</SelectItem>
                <SelectItem value="arquivada">Arquivada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fPasta} onValueChange={setFPasta}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Pasta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas pastas</SelectItem>
                <SelectItem value="__none__">Sem pasta</SelectItem>
                {pastas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Barra de seleção */}
      {selecionadas.size > 0 && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">
              {selecionadas.size} questão(ões) selecionada(s)
            </span>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <AdicionarEmPastaPopover
                pastas={pastas}
                onAdicionar={(pasta_id) =>
                  addPasta.mutate({ ids: Array.from(selecionadas), pasta_id })
                }
                onCriarNova={(nome) =>
                  criarPastaEAdd.mutate({ nome, ids: Array.from(selecionadas) })
                }
              />
              <AdicionarAoSimuladoPopover
                mode="questoes"
                ids={Array.from(selecionadas)}
                onSuccess={() => {
                  setSelecionadas(new Set());
                  qc.invalidateQueries({ queryKey: ["banco-questao-detalhe"] });
                }}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={14} className="mr-1" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Excluir {selecionadas.size} questão(ões)?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação remove permanentemente as questões e suas alternativas do banco. Não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => excluirSelecionadas.mutate(Array.from(selecionadas))}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" variant="ghost" onClick={() => setSelecionadas(new Set())}>
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-8 text-muted-foreground text-sm">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-muted-foreground text-sm text-center">
              Nenhuma questão encontrada com os filtros atuais.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={pagedQuestoes.length > 0 && pagedQuestoes.every((x) => selecionadas.has(x.id))}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Enunciado</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Disciplina</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Dif.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pastas</TableHead>
                    <TableHead>Criada</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedQuestoes.map((q) => {
                    const ps = pastasPorQuestao.get(q.id) ?? [];
                    return (
                      <TableRow key={q.id}>
                        <TableCell>
                          <Checkbox
                            checked={selecionadas.has(q.id)}
                            onCheckedChange={() => toggle(q.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {q.codigo_externo ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <p className="truncate text-sm">{stripMarkdown(q.enunciado)}</p>
                        </TableCell>
                        <TableCell className="text-xs">{q.area ?? "—"}</TableCell>
                        <TableCell className="text-xs">{q.disciplina ?? "—"}</TableCell>
                        <TableCell className="text-xs">{q.assunto ?? q.topico ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant="outline"
                            title={q.dificuldade ? `Nível ${q.dificuldade}` : "Padrão (médio) — questão sem nível definido"}
                            className={q.dificuldade ? "" : "text-muted-foreground"}
                          >
                            N{q.dificuldade ?? 3}
                          </Badge>
                        </TableCell>
                        <TableCell>{statusBadge(q.status)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ps.length}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatBrasilia(q.created_at, "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setDetalheId(q.id)}>
                              <Eye size={14} />
                            </Button>
                            <Button asChild size="sm" variant="ghost">
                              <Link to="/admin/questoes/$id" params={{ id: q.id }}>
                                <Pencil size={14} />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <DataPagination
                page={safePage}
                pageSize={pageSize}
                total={filteredLen}
                onPage={setPage}
                onPageSize={setPageSize}
                itemLabel="questões"
              />
            </>
          )}
        </CardContent>
      </Card>

      <DetalheQuestaoDialog
        questaoId={detalheId}
        onClose={() => setDetalheId(null)}
        pastasNomes={Object.fromEntries(pastas.map((p) => [p.id, p.nome]))}
      />
    </div>
  );
}

/* ----------------------------- helpers ----------------------------- */

function KpiCard({
  label, value, icon, tone,
}: {
  label: string; value: number; icon: React.ReactNode;
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
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function FiltroSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{label} (todos)</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AdicionarEmPastaPopover({
  pastas, onAdicionar, onCriarNova,
}: {
  pastas: { id: string; nome: string }[];
  onAdicionar: (pasta_id: string) => void;
  onCriarNova: (nome: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [novaPasta, setNovaPasta] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm">
          <FolderPlus size={14} className="mr-1" /> Adicionar em pasta
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 space-y-2">
        <p className="text-xs text-muted-foreground px-2 pt-1">Selecionar pasta existente</p>
        <div className="max-h-48 overflow-auto">
          {pastas.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3">Nenhuma pasta criada ainda.</p>
          )}
          {pastas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onAdicionar(p.id); setOpen(false); }}
              className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
            >
              {p.nome}
            </button>
          ))}
        </div>
        <div className="border-t pt-2">
          <p className="text-xs text-muted-foreground px-2 mb-1">Ou criar nova pasta</p>
          <div className="flex gap-1 px-1">
            <Input
              placeholder="Nome da pasta"
              value={novaPasta}
              onChange={(e) => setNovaPasta(e.target.value)}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              disabled={!novaPasta.trim()}
              onClick={() => {
                onCriarNova(novaPasta.trim());
                setNovaPasta("");
                setOpen(false);
              }}
            >
              Criar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ----------------------------- detalhe ----------------------------- */

function DetalheQuestaoDialog({
  questaoId, onClose, pastasNomes,
}: {
  questaoId: string | null;
  onClose: () => void;
  pastasNomes: Record<string, string>;
}) {
  const enabled = !!questaoId;
  const { data, isLoading } = useQuery({
    enabled,
    queryKey: ["banco-questao-detalhe", questaoId],
    queryFn: async () => {
      const id = questaoId!;
      const [qRes, altRes, qsRes, vpRes] = await Promise.all([
        supabase.from("questoes").select("*").eq("id", id).single(),
        supabase.from("alternativas").select("*").eq("questao_id", id).order("letra"),
        supabase.from("questao_simulado").select("simulado_id").eq("questao_id", id),
        supabase.from("questao_pasta").select("pasta_id").eq("questao_id", id),
      ]);
      if (qRes.error) throw qRes.error;
      const simIds = (qsRes.data ?? []).map((r) => r.simulado_id);
      let simulados: Array<{ id: string; titulo: string; status: string }> = [];
      if (simIds.length > 0) {
        const { data: sims } = await supabase
          .from("simulados")
          .select("id, titulo, status")
          .in("id", simIds);
        simulados = (sims ?? []) as Array<{ id: string; titulo: string; status: string }>;
      }
      return {
        questao: qRes.data,
        alternativas: altRes.data ?? [],
        simulados,
        pastas: (vpRes.data ?? []).map((p) => p.pasta_id),
      };
    },
  });

  return (
    <Dialog open={enabled} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da questão</DialogTitle>
          <DialogDescription>
            Dados completos, alternativas e simulados que utilizam esta questão.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground py-6">Carregando...</p>
        ) : (
          <div className="space-y-5">
            <section className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Info label="Código" value={data.questao.codigo_externo ?? "—"} />
              <Info label="Status" value={STATUS_LABEL[(data.questao.status ?? "ativa") as StatusQ]} />
              <Info label="Dificuldade" value={`Nível ${data.questao.dificuldade ?? 3}${data.questao.dificuldade ? "" : " (padrão)"}`} />
              <Info label="Fonte" value={data.questao.fonte ?? "—"} />
              <Info label="Área" value={data.questao.area ?? "—"} />
              <Info label="Disciplina" value={data.questao.disciplina ?? "—"} />
              <Info label="Assunto" value={data.questao.assunto ?? data.questao.topico ?? "—"} />
              <Info label="Criada em" value={formatBrasilia(data.questao.created_at, "dd/MM/yyyy HH:mm")} />
            </section>

            <section>
              <h3 className="font-semibold text-sm mb-1">Enunciado</h3>
              <Markdown className="text-sm">{data.questao.enunciado}</Markdown>
            </section>

            <section>
              <h3 className="font-semibold text-sm mb-2">Alternativas</h3>
              <ul className="space-y-1">
                {data.alternativas.map((a) => (
                  <li
                    key={a.id}
                    className={`p-2 rounded border text-sm ${
                      a.correta ? "border-emerald-500/40 bg-emerald-500/5" : "border-secondary/20"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <strong className="shrink-0">{a.letra})</strong>
                      <div className="flex-1 min-w-0">
                        <Markdown className="text-sm">{a.texto}</Markdown>
                      </div>
                      {a.correta && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shrink-0">
                          Correta
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {data.questao.explicacao && (
              <section>
                <h3 className="font-semibold text-sm mb-1">Comentário / Explicação</h3>
                <Markdown className="text-sm text-muted-foreground">
                  {data.questao.explicacao}
                </Markdown>
              </section>
            )}

            <section>
              <h3 className="font-semibold text-sm mb-2">Pastas vinculadas ({data.pastas.length})</h3>
              <div className="flex flex-wrap gap-1">
                {data.pastas.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Sem pasta.</span>
                ) : (
                  data.pastas.map((pid) => (
                    <Badge key={pid} variant="secondary">📁 {pastasNomes[pid] ?? pid.slice(0, 6)}</Badge>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="font-semibold text-sm mb-2">
                Simulados que utilizam ({data.simulados.length})
              </h3>
              {data.simulados.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Esta questão não está vinculada a nenhum simulado.
                </p>
              ) : (
                <ul className="space-y-1">
                  {data.simulados.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between p-2 rounded border border-secondary/20 text-sm"
                    >
                      <span>{s.titulo}</span>
                      <Badge variant="outline">{s.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
