import { createFileRoute, Link, useParams } from "@tanstack/react-router";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  ArrowLeft, Users, UserPlus, Search, Trash2, ClipboardList, Plus, Link2, Eye,
} from "lucide-react";
import { formatBrasilia } from "@/lib/datetime";

export const Route = createFileRoute("/_authenticated/admin/grupos/$id")({
  head: () => ({ meta: [{ title: "Grupo — Painel Admin" }] }),
  component: GrupoDetalhe,
});

type Estudante = {
  id: string; email: string; nome: string | null; cpf: string | null; ultimo_acesso: string | null;
};
type SimuladoMin = {
  id: string; titulo: string; status: string; data_inicio: string | null;
};

function GrupoDetalhe() {
  const { id } = useParams({ from: "/_authenticated/admin/grupos/$id" });

  const { data: grupo } = useQuery({
    queryKey: ["grupo", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupos").select("*").eq("id", id).single();
      if (error) throw error;
      return data as { id: string; nome: string; descricao: string | null; cor: string | null; arquivado: boolean };
    },
  });

  if (!grupo) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <Toaster />
      <Link
        to="/admin/grupos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={14} /> Voltar para grupos
      </Link>

      <header className="flex flex-wrap items-start gap-3">
        <span
          className="h-6 w-6 rounded-full shrink-0 mt-1"
          style={{ background: grupo.cor ?? "hsl(220 70% 55%)" }}
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold">{grupo.nome}</h1>
          {grupo.descricao && <p className="text-muted-foreground mt-1">{grupo.descricao}</p>}
        </div>
        {grupo.arquivado && <Badge variant="outline">Arquivado</Badge>}
      </header>

      <Tabs defaultValue="membros">
        <TabsList>
          <TabsTrigger value="membros">Membros</TabsTrigger>
          <TabsTrigger value="simulados">Simulados</TabsTrigger>
        </TabsList>
        <TabsContent value="membros" className="mt-6">
          <TabMembros grupoId={id} />
        </TabsContent>
        <TabsContent value="simulados" className="mt-6">
          <TabSimulados grupoId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------- Membros ------------------- */
function TabMembros({ grupoId }: { grupoId: string }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const { data: membros = [], isLoading } = useQuery({
    queryKey: ["grupo-membros", grupoId],
    queryFn: async () => {
      const { data: ms, error } = await supabase
        .from("grupo_membros").select("estudante_id").eq("grupo_id", grupoId);
      if (error) throw error;
      const ids = (ms ?? []).map((m) => m.estudante_id);
      if (ids.length === 0) return [] as Estudante[];
      const { data, error: e2 } = await supabase
        .from("estudantes")
        .select("id, email, nome, cpf, ultimo_acesso")
        .in("id", ids)
        .order("nome");
      if (e2) throw e2;
      return data as Estudante[];
    },
  });

  const filtered = useMemo(() => {
    const s = busca.trim().toLowerCase();
    if (!s) return membros;
    return membros.filter((e) =>
      e.email.toLowerCase().includes(s) ||
      (e.nome ?? "").toLowerCase().includes(s) ||
      (e.cpf ?? "").includes(s)
    );
  }, [membros, busca]);

  function toggle(id: string) {
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (sel.size === filtered.length) setSel(new Set());
    else setSel(new Set(filtered.map((e) => e.id)));
  }

  const remover = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("grupo_membros").delete()
        .eq("grupo_id", grupoId).in("estudante_id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} membro(s) removido(s)`);
      setSel(new Set());
      qc.invalidateQueries({ queryKey: ["grupo-membros", grupoId] });
      qc.invalidateQueries({ queryKey: ["grupo-membros-counts"] });
      qc.invalidateQueries({ queryKey: ["grupo-membros-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar membro..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <AdicionarMembrosPopover grupoId={grupoId} />
          {sel.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-destructive">
                  <Trash2 size={14} className="mr-1" /> Remover ({sel.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover {sel.size} membro(s)?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os estudantes serão desvinculados do grupo. Matrículas individuais já criadas permanecem.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground"
                    onClick={() => remover.mutate(Array.from(sel))}
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">
            Nenhum membro neste grupo ainda.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={sel.size > 0 && sel.size === filtered.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="text-right">Perfil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Checkbox checked={sel.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{e.nome ?? "—"}</TableCell>
                  <TableCell className="text-xs">{e.email}</TableCell>
                  <TableCell className="text-xs font-mono">{e.cpf ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.ultimo_acesso ? formatBrasilia(e.ultimo_acesso, "dd/MM/yyyy HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/admin/estudantes/$id" params={{ id: e.id }}>
                        <Eye size={14} />
                      </Link>
                    </Button>
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

function AdicionarMembrosPopover({ grupoId }: { grupoId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const { data: existentes } = useQuery({
    enabled: open,
    queryKey: ["grupo-membros-ids", grupoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_membros").select("estudante_id").eq("grupo_id", grupoId);
      if (error) throw error;
      return new Set((data ?? []).map((m) => m.estudante_id));
    },
  });

  const { data: todos = [] } = useQuery({
    enabled: open,
    queryKey: ["estudantes-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estudantes").select("id, email, nome").order("nome").limit(1000);
      if (error) throw error;
      return data as { id: string; email: string; nome: string | null }[];
    },
  });

  const filtered = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return todos.filter((e) => {
      if (existentes?.has(e.id)) return false;
      if (!s) return true;
      return e.email.toLowerCase().includes(s) || (e.nome ?? "").toLowerCase().includes(s);
    });
  }, [todos, existentes, busca]);

  const add = useMutation({
    mutationFn: async (ids: string[]) => {
      const rows = ids.map((estudante_id) => ({ grupo_id: grupoId, estudante_id }));
      const { error } = await supabase
        .from("grupo_membros")
        .upsert(rows, { onConflict: "grupo_id,estudante_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} estudante(s) adicionado(s)`);
      setSel(new Set());
      qc.invalidateQueries({ queryKey: ["grupo-membros", grupoId] });
      qc.invalidateQueries({ queryKey: ["grupo-membros-ids", grupoId] });
      qc.invalidateQueries({ queryKey: ["grupo-membros-counts"] });
      qc.invalidateQueries({ queryKey: ["grupo-membros-all"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string) {
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm"><UserPlus size={14} className="mr-1" /> Adicionar estudantes</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-2 space-y-2">
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="max-h-72 overflow-auto space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">
              Nenhum estudante disponível.
            </p>
          )}
          {filtered.slice(0, 100).map((e) => (
            <label
              key={e.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm cursor-pointer"
            >
              <Checkbox checked={sel.has(e.id)} onCheckedChange={() => toggle(e.id)} />
              <div className="flex-1 min-w-0">
                <p className="truncate">{e.nome ?? <span className="italic text-muted-foreground">sem nome</span>}</p>
                <p className="text-xs text-muted-foreground truncate">{e.email}</p>
              </div>
            </label>
          ))}
          {filtered.length > 100 && (
            <p className="text-xs text-muted-foreground p-1 text-center">
              Mostrando 100 de {filtered.length}. Refine a busca.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-xs text-muted-foreground">{sel.size} selecionado(s)</span>
          <Button
            size="sm"
            disabled={sel.size === 0 || add.isPending}
            onClick={() => add.mutate(Array.from(sel))}
          >
            Adicionar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------- Simulados ------------------- */
function TabSimulados({ grupoId }: { grupoId: string }) {
  const qc = useQueryClient();

  const { data: vincs = [], isLoading } = useQuery({
    queryKey: ["grupo-simulado", grupoId],
    queryFn: async () => {
      const { data: gs, error } = await supabase
        .from("grupo_simulado").select("simulado_id").eq("grupo_id", grupoId);
      if (error) throw error;
      const ids = (gs ?? []).map((x) => x.simulado_id);
      if (ids.length === 0) return [] as SimuladoMin[];
      const { data, error: e2 } = await supabase
        .from("simulados").select("id, titulo, status, data_inicio").in("id", ids);
      if (e2) throw e2;
      return data as SimuladoMin[];
    },
  });

  const { data: membros = [] } = useQuery({
    queryKey: ["grupo-membros-only", grupoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_membros").select("estudante_id").eq("grupo_id", grupoId);
      if (error) throw error;
      return (data ?? []).map((m) => m.estudante_id);
    },
  });

  const desvincular = useMutation({
    mutationFn: async (simulado_id: string) => {
      const { error } = await supabase
        .from("grupo_simulado").delete()
        .eq("grupo_id", grupoId).eq("simulado_id", simulado_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Simulado desvinculado. Matrículas individuais foram mantidas.");
      qc.invalidateQueries({ queryKey: ["grupo-simulado", grupoId] });
      qc.invalidateQueries({ queryKey: ["grupo-simulado-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <VincularSimuladoPopover grupoId={grupoId} membros={membros} />
          <span className="text-xs text-muted-foreground ml-2">
            Vincular cria matrícula para todos os {membros.length} membros atuais do grupo.
          </span>
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Carregando...</p>
        ) : vincs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">
            Nenhum simulado vinculado a este grupo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Simulado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vincs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.titulo}</TableCell>
                  <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.data_inicio ? formatBrasilia(s.data_inicio, "dd/MM/yyyy HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/admin/simulados/$id" params={{ id: s.id }}>Abrir</Link>
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="text-destructive"
                      onClick={() => desvincular.mutate(s.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
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

function VincularSimuladoPopover({
  grupoId, membros,
}: { grupoId: string; membros: string[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const { data: existentes } = useQuery({
    enabled: open,
    queryKey: ["grupo-simulado-ids", grupoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_simulado").select("simulado_id").eq("grupo_id", grupoId);
      if (error) throw error;
      return new Set((data ?? []).map((x) => x.simulado_id));
    },
  });

  const { data: simulados = [] } = useQuery({
    enabled: open,
    queryKey: ["simulados-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulados").select("id, titulo, status")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data as { id: string; titulo: string; status: string }[];
    },
  });

  const filtered = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return simulados.filter((q) => {
      if (existentes?.has(q.id)) return false;
      if (!s) return true;
      return q.titulo.toLowerCase().includes(s);
    });
  }, [simulados, existentes, busca]);

  const vincular = useMutation({
    mutationFn: async (simulado_id: string) => {
      const { error: e1 } = await supabase
        .from("grupo_simulado")
        .upsert({ grupo_id: grupoId, simulado_id }, { onConflict: "grupo_id,simulado_id", ignoreDuplicates: true });
      if (e1) throw e1;
      if (membros.length > 0) {
        const rows = membros.map((estudante_id) => ({
          estudante_id, simulado_id, liberado: true,
        }));
        const { error: e2 } = await supabase
          .from("matriculas")
          .upsert(rows, { onConflict: "estudante_id,simulado_id", ignoreDuplicates: true });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success(`Simulado vinculado. ${membros.length} matrícula(s) criada(s).`);
      qc.invalidateQueries({ queryKey: ["grupo-simulado", grupoId] });
      qc.invalidateQueries({ queryKey: ["grupo-simulado-ids", grupoId] });
      qc.invalidateQueries({ queryKey: ["grupo-simulado-counts"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm">
          <Link2 size={14} className="mr-1" /> Vincular simulado
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2 space-y-2">
        <Input
          placeholder="Buscar simulado..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="max-h-72 overflow-auto">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">
              Nenhum simulado disponível.
            </p>
          )}
          {filtered.slice(0, 50).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => vincular.mutate(s.id)}
              className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted flex items-center justify-between gap-2"
            >
              <span className="truncate flex items-center gap-2">
                <ClipboardList size={12} /> {s.titulo}
              </span>
              <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
