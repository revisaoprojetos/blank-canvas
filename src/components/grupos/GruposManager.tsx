import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Users, Plus, MoreVertical, Pencil, Copy, Archive, ArchiveRestore,
  Trash2, ClipboardList, Search,
} from "lucide-react";

type Grupo = {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  arquivado: boolean;
  created_at: string;
};

export function GruposManager() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [verArquivados, setVerArquivados] = useState(false);
  const [editando, setEditando] = useState<Grupo | null>(null);
  const [criando, setCriando] = useState(false);

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["grupos-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupos")
        .select("id, nome, descricao, cor, arquivado, created_at")
        .order("nome");
      if (error) throw error;
      return data as Grupo[];
    },
  });

  const { data: membros = [] } = useQuery({
    queryKey: ["grupo-membros-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupo_membros").select("grupo_id");
      if (error) throw error;
      return data as { grupo_id: string }[];
    },
  });

  const { data: vincs = [] } = useQuery({
    queryKey: ["grupo-simulado-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupo_simulado").select("grupo_id");
      if (error) throw error;
      return data as { grupo_id: string }[];
    },
  });

  const countMembros = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of membros) m.set(x.grupo_id, (m.get(x.grupo_id) ?? 0) + 1);
    return m;
  }, [membros]);

  const countSimulados = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of vincs) m.set(x.grupo_id, (m.get(x.grupo_id) ?? 0) + 1);
    return m;
  }, [vincs]);

  const filtered = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return grupos.filter((g) => {
      if (!verArquivados && g.arquivado) return false;
      if (!s) return true;
      return g.nome.toLowerCase().includes(s) || (g.descricao ?? "").toLowerCase().includes(s);
    });
  }, [grupos, busca, verArquivados]);

  const totalEstudantes = membros.length;
  const ativos = grupos.filter((g) => !g.arquivado).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Organize estudantes em grupos e vincule-os a simulados de uma só vez.
        </p>
        <Button onClick={() => setCriando(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus size={16} className="mr-1" /> Novo grupo
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiGrupo label="Grupos ativos" value={ativos} icon={<Users size={16} />} />
        <KpiGrupo label="Total de grupos" value={grupos.length} icon={<Users size={16} />} />
        <KpiGrupo label="Vínculos de estudantes" value={totalEstudantes} icon={<Users size={16} />} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar grupo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={verArquivados}
                onChange={(e) => setVerArquivados(e.target.checked)}
              />
              Mostrar arquivados
            </label>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground p-6 text-center">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Users size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {busca ? "Nenhum grupo encontrado." : "Crie seu primeiro grupo para organizar estudantes."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <GrupoCard
              key={g.id}
              grupo={g}
              nMembros={countMembros.get(g.id) ?? 0}
              nSimulados={countSimulados.get(g.id) ?? 0}
              onEdit={() => setEditando(g)}
              onChanged={() => {
                qc.invalidateQueries({ queryKey: ["grupos-full"] });
                qc.invalidateQueries({ queryKey: ["grupos-min"] });
                qc.invalidateQueries({ queryKey: ["grupo-membros-counts"] });
                qc.invalidateQueries({ queryKey: ["grupo-simulado-counts"] });
              }}
            />
          ))}
        </div>
      )}

      {(criando || editando) && (
        <GrupoFormDialog
          grupo={editando}
          onClose={() => { setCriando(false); setEditando(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["grupos-full"] });
            qc.invalidateQueries({ queryKey: ["grupos-min"] });
          }}
        />
      )}
    </div>
  );
}

function GrupoCard({
  grupo, nMembros, nSimulados, onEdit, onChanged,
}: {
  grupo: Grupo;
  nMembros: number;
  nSimulados: number;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const arquivar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("grupos").update({ arquivado: !grupo.arquivado }).eq("id", grupo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(grupo.arquivado ? "Grupo restaurado" : "Grupo arquivado");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("grupos")
        .insert({ nome: `${grupo.nome} (cópia)`, descricao: grupo.descricao, cor: grupo.cor })
        .select("id").single();
      if (error) throw error;
      const { data: ms } = await supabase
        .from("grupo_membros").select("estudante_id").eq("grupo_id", grupo.id);
      if (ms && ms.length > 0) {
        const rows = ms.map((m) => ({ grupo_id: data!.id, estudante_id: m.estudante_id }));
        await supabase.from("grupo_membros").insert(rows);
      }
    },
    onSuccess: () => { toast.success("Grupo duplicado"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("grupos").delete().eq("id", grupo.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Grupo excluído"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className={grupo.arquivado ? "opacity-70" : ""}>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link to="/admin/grupos/$id" params={{ id: grupo.id }} className="block group">
            <CardTitle className="text-base flex items-center gap-2 truncate group-hover:text-accent">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ background: grupo.cor ?? "hsl(220 70% 55%)" }}
              />
              {grupo.nome}
              {grupo.arquivado && <Badge variant="outline" className="text-[10px]">arq.</Badge>}
            </CardTitle>
          </Link>
          {grupo.descricao && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{grupo.descricao}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical size={14} /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil size={14} className="mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicar.mutate()}>
              <Copy size={14} className="mr-2" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => arquivar.mutate()}>
              {grupo.arquivado ? (
                <><ArchiveRestore size={14} className="mr-2" /> Desarquivar</>
              ) : (
                <><Archive size={14} className="mr-2" /> Arquivar</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive"
                >
                  <Trash2 size={14} className="mr-2" /> Excluir
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir grupo "{grupo.nome}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os vínculos com estudantes e simulados serão removidos. Matrículas individuais já criadas permanecem.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground"
                    onClick={() => excluir.mutate()}
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="pt-0">
        <Link to="/admin/grupos/$id" params={{ id: grupo.id }} className="block">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users size={13} /> <span className="font-semibold text-foreground">{nMembros}</span> membros
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <ClipboardList size={13} /> <span className="font-semibold text-foreground">{nSimulados}</span> simulados
            </span>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

function GrupoFormDialog({
  grupo, onClose, onSaved,
}: {
  grupo: Grupo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = !!grupo;
  const [nome, setNome] = useState(grupo?.nome ?? "");
  const [descricao, setDescricao] = useState(grupo?.descricao ?? "");
  const [cor, setCor] = useState(grupo?.cor ?? "#3b82f6");

  const save = useMutation({
    mutationFn: async () => {
      const nomeTrim = nome.trim();
      if (!nomeTrim) throw new Error("Informe o nome");
      const payload = { nome: nomeTrim, descricao: descricao.trim() || null, cor };
      if (editando) {
        const { error } = await supabase.from("grupos").update(payload).eq("id", grupo!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("grupos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editando ? "Grupo atualizado" : "Grupo criado"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? "Editar grupo" : "Novo grupo"}</DialogTitle>
          <DialogDescription>
            Os grupos servem para organizar estudantes e vincular vários ao mesmo simulado de uma vez.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="desc">Descrição</Label>
            <Textarea
              id="desc" rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cor">Cor</Label>
            <Input id="cor" type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-10 w-24" />
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

function KpiGrupo({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="p-2 rounded-md bg-primary/10 text-primary">{icon}</div>
      </CardHeader>
      <CardContent><div className="text-3xl font-bold">{value}</div></CardContent>
    </Card>
  );
}
