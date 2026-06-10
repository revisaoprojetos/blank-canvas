import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Users, Search, Download, Trash2, UserPlus, Pencil,
  CheckCircle2, Clock, AlertCircle, Plus, Upload,
} from "lucide-react";
import { ImportarEstudantesCSV } from "@/components/estudantes/ImportarEstudantesCSV";
import { GruposManager } from "@/components/grupos/GruposManager";
import { formatBrasilia } from "@/lib/datetime";
import { DataPagination, useStickyState } from "@/components/ui/data-pagination";
import { AdicionarAoSimuladoPopover } from "@/components/simulados/AdicionarAoSimuladoPopover";

export const Route = createFileRoute("/_authenticated/admin/estudantes/")({
  head: () => ({ meta: [{ title: "Estudantes — Painel Admin" }] }),
  component: EstudantesPage,
});

type Estudante = {
  id: string;
  email: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  primeiro_acesso: string;
  ultimo_acesso: string | null;
  created_at: string;
};

type Grupo = { id: string; nome: string };

function EstudantesPage() {
  const [tab, setTab] = useStickyState<string>("est:tab", "lista");
  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <Toaster />
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-primary">Estudantes</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie estudantes e organize-os em grupos.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
        </TabsList>

        <TabsContent value="lista"><TabLista /></TabsContent>
        <TabsContent value="grupos"><GruposManager /></TabsContent>
      </Tabs>
    </div>
  );
}

function TabLista() {
  const qc = useQueryClient();
  const [busca, setBusca] = useStickyState<string>("est:busca", "");
  const [fGrupo, setFGrupo] = useStickyState<string>("est:fGrupo", "__all__");
  const [fAcesso, setFAcesso] = useStickyState<string>("est:fAcesso", "__all__");
  const [page, setPage] = useStickyState<number>("est:page", 1);
  const [pageSize, setPageSize] = useStickyState<number>("est:pageSize", 20);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [criando, setCriando] = useState(false);
  const [importando, setImportando] = useState(false);

  const { data: estudantes = [], isLoading } = useQuery({
    queryKey: ["estudantes-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estudantes")
        .select("id, email, nome, cpf, telefone, primeiro_acesso, ultimo_acesso, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data as Estudante[];
    },
  });

  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupos").select("id, nome").eq("arquivado", false).order("nome");
      if (error) throw error;
      return data as Grupo[];
    },
  });

  const { data: membros = [] } = useQuery({
    queryKey: ["grupo-membros-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_membros").select("estudante_id, grupo_id");
      if (error) throw error;
      return data as { estudante_id: string; grupo_id: string }[];
    },
  });

  const gruposPorEst = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const x of membros) {
      const a = m.get(x.estudante_id) ?? [];
      a.push(x.grupo_id);
      m.set(x.estudante_id, a);
    }
    return m;
  }, [membros]);

  const grupoNomes = useMemo(
    () => new Map(grupos.map((g) => [g.id, g.nome])),
    [grupos]
  );

  const filtered = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return estudantes.filter((e) => {
      if (fGrupo !== "__all__") {
        const gs = gruposPorEst.get(e.id) ?? [];
        if (fGrupo === "__none__" && gs.length > 0) return false;
        if (fGrupo !== "__none__" && !gs.includes(fGrupo)) return false;
      }
      if (fAcesso === "ativos" && !e.ultimo_acesso) return false;
      if (fAcesso === "inativos" && e.ultimo_acesso) return false;
      if (!s) return true;
      return (
        e.email.toLowerCase().includes(s) ||
        (e.nome ?? "").toLowerCase().includes(s)
      );
    });
  }, [estudantes, busca, fGrupo, fAcesso, gruposPorEst]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  const kpis = useMemo(() => {
    const total = estudantes.length;
    const ativos = estudantes.filter((e) => e.ultimo_acesso).length;
    const novos7d = estudantes.filter((e) => {
      const d = new Date(e.created_at).getTime();
      return Date.now() - d < 7 * 24 * 3600 * 1000;
    }).length;
    const semGrupo = estudantes.filter((e) => (gruposPorEst.get(e.id) ?? []).length === 0).length;
    return { total, ativos, novos7d, semGrupo };
  }, [estudantes, gruposPorEst]);

  function toggle(id: string) {
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (paged.every((e) => sel.has(e.id)) && paged.length > 0) setSel(new Set());
    else setSel(new Set(paged.map((e) => e.id)));
  }

  const addGrupo = useMutation({
    mutationFn: async ({ ids, grupo_id }: { ids: string[]; grupo_id: string }) => {
      const rows = ids.map((estudante_id) => ({ estudante_id, grupo_id }));
      const { error } = await supabase
        .from("grupo_membros")
        .upsert(rows, { onConflict: "grupo_id,estudante_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`${v.ids.length} estudante(s) adicionado(s) ao grupo`);
      setSel(new Set());
      qc.invalidateQueries({ queryKey: ["grupo-membros-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("estudantes").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} estudante(s) excluído(s)`);
      setSel(new Set());
      qc.invalidateQueries({ queryKey: ["estudantes-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportarCSV() {
    const cols = ["email", "nome", "cpf", "telefone", "primeiro_acesso", "ultimo_acesso"];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = filtered.map((e) =>
      [e.email, e.nome, e.cpf, e.telefone, e.primeiro_acesso, e.ultimo_acesso].map(esc).join(",")
    );
    const blob = new Blob([cols.join(",") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estudantes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total" value={kpis.total} icon={<Users size={16} />} tone="primary" />
        <Kpi label="Acessaram pelo menos uma vez" value={kpis.ativos} icon={<CheckCircle2 size={16} />} tone="success" />
        <Kpi label="Novos (7 dias)" value={kpis.novos7d} icon={<Clock size={16} />} tone="muted" />
        <Kpi label="Sem grupo" value={kpis.semGrupo} icon={<AlertCircle size={16} />} tone="warn" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setCriando(true)}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus size={14} className="mr-1" /> Adicionar estudante
          </Button>
          <Button variant="outline" onClick={() => setImportando(true)}>
            <Upload size={14} className="mr-1" /> Importar estudantes
          </Button>
          <Button variant="outline" onClick={exportarCSV}>
            <Download size={14} className="mr-1" /> Exportar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Select value={fGrupo} onValueChange={setFGrupo}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Grupo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os grupos</SelectItem>
                <SelectItem value="__none__">Sem grupo</SelectItem>
                {grupos.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fAcesso} onValueChange={setFAcesso}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Acesso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="ativos">Já acessaram</SelectItem>
                <SelectItem value="inativos">Nunca acessaram</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {sel.size > 0 && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">
              {sel.size} estudante(s) selecionado(s)
            </span>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <AdicionarGrupoPopover
                grupos={grupos}
                onAdicionar={(grupo_id) =>
                  addGrupo.mutate({ ids: Array.from(sel), grupo_id })
                }
              />
              <AdicionarAoSimuladoPopover
                mode="estudantes"
                ids={Array.from(sel)}
                onSuccess={() => setSel(new Set())}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive">
                    <Trash2 size={14} className="mr-1" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {sel.size} estudante(s)?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação remove os estudantes, suas matrículas e sessões. Não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground"
                      onClick={() => excluir.mutate(Array.from(sel))}
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-8 text-sm text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground text-center">
              Nenhum estudante encontrado.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={paged.length > 0 && paged.every((e) => sel.has(e.id))}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead className="text-right">Edição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((e) => {
                    const gs = gruposPorEst.get(e.id) ?? [];
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Checkbox
                            checked={sel.has(e.id)}
                            onCheckedChange={() => toggle(e.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {e.nome ?? <span className="text-muted-foreground italic">sem nome</span>}
                        </TableCell>
                        <TableCell className="text-xs">{e.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {gs.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              gs.slice(0, 2).map((gid) => (
                                <Badge key={gid} variant="secondary" className="text-[10px]">
                                  {grupoNomes.get(gid) ?? "?"}
                                </Badge>
                              ))
                            )}
                            {gs.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{gs.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {e.ultimo_acesso ? formatBrasilia(e.ultimo_acesso, "dd/MM/yyyy HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link to="/admin/estudantes/$id" params={{ id: e.id }}>
                              <Pencil size={14} />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <DataPagination
                page={safePage}
                pageSize={pageSize}
                total={filtered.length}
                onPage={setPage}
                onPageSize={setPageSize}
                itemLabel="estudantes"
              />
            </>
          )}
        </CardContent>
      </Card>

      {criando && (
        <CriarEstudanteDialog
          onClose={() => setCriando(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["estudantes-full"] })}
        />
      )}

      {importando && (
        <Dialog open onOpenChange={(o) => !o && setImportando(false)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Importar estudantes</DialogTitle>
              <DialogDescription>
                Envie um arquivo CSV com os estudantes para cadastro em lote.
              </DialogDescription>
            </DialogHeader>
            <ImportarEstudantesCSV
              onConcluido={() => {
                qc.invalidateQueries({ queryKey: ["estudantes-full"] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CriarEstudanteDialog({
  onClose, onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const e = email.trim().toLowerCase();
      if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        throw new Error("Informe um e-mail válido");
      }
      const { error } = await supabase.from("estudantes").insert({
        email: e,
        nome: nome.trim() || null,
        telefone: telefone.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Estudante criado"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar estudante</DialogTitle>
          <DialogDescription>
            Cadastre um novo estudante manualmente. O e-mail é obrigatório.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="email">E-mail *</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tel">Telefone</Label>
            <Input id="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdicionarGrupoPopover({
  grupos, onAdicionar,
}: { grupos: Grupo[]; onAdicionar: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm">
          <UserPlus size={14} className="mr-1" /> Adicionar ao grupo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        {grupos.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">
            Nenhum grupo criado ainda.
          </p>
        ) : (
          <div className="max-h-60 overflow-auto">
            {grupos.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => { onAdicionar(g.id); setOpen(false); }}
                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
              >
                {g.nome}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
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
