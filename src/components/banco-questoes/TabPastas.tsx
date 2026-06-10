import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Folder, FolderOpen, FolderPlus, ChevronRight, ChevronDown, MoreVertical,
  Pencil, Copy, Archive, ArchiveRestore, Trash2, Search, Plus, X, Move,
  FileQuestion,
} from "lucide-react";
import { toast } from "sonner";
import { stripMarkdown } from "@/components/ui/markdown";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export type PastaTree = {
  id: string;
  nome: string;
  descricao: string | null;
  parent_id: string | null;
  arquivada: boolean;
  children: PastaTree[];
  count: number;
};

type PastaRow = {
  id: string;
  nome: string;
  descricao: string | null;
  parent_id: string | null;
  arquivada: boolean;
};

type QuestaoMin = {
  id: string;
  codigo_externo: string | null;
  enunciado: string;
  disciplina: string | null;
  area: string | null;
  assunto: string | null;
  topico: string | null;
  dificuldade: number | null;
  status: "ativa" | "em_revisao" | "arquivada";
};

export function TabPastas() {
  const qc = useQueryClient();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<PastaRow | null>(null);
  const [criandoSob, setCriandoSob] = useState<string | "root" | null>(null);
  const [buscaPasta, setBuscaPasta] = useState("");

  const { data: pastas = [], isLoading } = useQuery({
    queryKey: ["pastas-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pastas")
        .select("id, nome, descricao, parent_id, arquivada")
        .order("nome");
      if (error) throw error;
      return data as PastaRow[];
    },
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["questao-pasta-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questao_pasta")
        .select("questao_id, pasta_id");
      if (error) throw error;
      return data as { questao_id: string; pasta_id: string }[];
    },
  });

  const countByPasta = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vinculos) m.set(v.pasta_id, (m.get(v.pasta_id) ?? 0) + 1);
    return m;
  }, [vinculos]);

  const pastasFiltradas = useMemo(() => {
    const s = buscaPasta.trim().toLowerCase();
    if (!s) return pastas;
    // Match by nome/descricao; include ancestors so the tree stays connected.
    const byId = new Map(pastas.map((p) => [p.id, p]));
    const matched = new Set<string>();
    for (const p of pastas) {
      if (
        p.nome.toLowerCase().includes(s) ||
        (p.descricao ?? "").toLowerCase().includes(s)
      ) {
        matched.add(p.id);
        let cur = p.parent_id;
        while (cur) {
          if (matched.has(cur)) break;
          matched.add(cur);
          cur = byId.get(cur)?.parent_id ?? null;
        }
      }
    }
    return pastas.filter((p) => matched.has(p.id));
  }, [pastas, buscaPasta]);

  const tree = useMemo(
    () => buildTree(pastasFiltradas, countByPasta, mostrarArquivadas),
    [pastasFiltradas, countByPasta, mostrarArquivadas]
  );

  function toggleExpand(id: string) {
    setExpandidas((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FolderOpen size={16} className="text-primary" /> Estrutura de pastas
            </h3>
            <Button size="sm" variant="outline" onClick={() => setCriandoSob("root")}>
              <FolderPlus size={14} className="mr-1" /> Nova
            </Button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar pasta..."
              value={buscaPasta}
              onChange={(e) => setBuscaPasta(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={mostrarArquivadas}
              onCheckedChange={(c) => setMostrarArquivadas(!!c)}
            />
            Mostrar arquivadas
          </label>

          {isLoading ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : tree.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhuma pasta criada ainda.
            </p>
          ) : (
            <div className="space-y-0.5 max-h-[60vh] overflow-auto">
              {tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selecionada={selecionada}
                  expandidas={buscaPasta.trim() ? new Set(pastasFiltradas.map((p) => p.id)) : expandidas}
                  onSelect={setSelecionada}
                  onToggle={toggleExpand}
                  onEdit={setEditando}
                  onCriarSub={(id) => setCriandoSob(id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        {selecionada ? (
          <PainelPasta
            pastaId={selecionada}
            pastas={pastas}
            onEdit={(p) => setEditando(p)}
            onClose={() => setSelecionada(null)}
          />
        ) : (
          <Card className="p-12 text-center border-dashed">
            <p className="text-muted-foreground text-sm">
              Selecione uma pasta à esquerda para visualizar e gerenciar suas questões.
            </p>
          </Card>
        )}
      </div>

      {editando && (
        <PastaFormDialog
          pasta={editando}
          todasPastas={pastas}
          onClose={() => setEditando(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["pastas-full"] });
            qc.invalidateQueries({ queryKey: ["pastas"] });
          }}
        />
      )}
      {criandoSob !== null && (
        <PastaFormDialog
          pasta={null}
          parentDefault={criandoSob === "root" ? null : criandoSob}
          todasPastas={pastas}
          onClose={() => setCriandoSob(null)}
          onSaved={(id) => {
            qc.invalidateQueries({ queryKey: ["pastas-full"] });
            qc.invalidateQueries({ queryKey: ["pastas"] });
            if (criandoSob !== "root" && typeof criandoSob === "string") {
              setExpandidas((p) => new Set(p).add(criandoSob));
            }
            if (id) setSelecionada(id);
          }}
        />
      )}
    </div>
  );
}

function buildTree(rows: PastaRow[], counts: Map<string, number>, incluirArquivadas: boolean): PastaTree[] {
  const filtradas = rows.filter((r) => incluirArquivadas || !r.arquivada);
  const byParent = new Map<string | null, PastaRow[]>();
  for (const r of filtradas) {
    const k = r.parent_id;
    const arr = byParent.get(k) ?? [];
    arr.push(r);
    byParent.set(k, arr);
  }
  const allIds = new Set(filtradas.map((r) => r.id));
  function build(parent: string | null): PastaTree[] {
    return (byParent.get(parent) ?? [])
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((r) => ({
        id: r.id,
        nome: r.nome,
        descricao: r.descricao,
        parent_id: r.parent_id,
        arquivada: r.arquivada,
        children: build(r.id),
        count: counts.get(r.id) ?? 0,
      }));
  }
  // Treat orphan items (parent existed but was hidden/filtered) as root
  const roots = build(null);
  const orphanRoots: PastaTree[] = [];
  for (const r of filtradas) {
    if (r.parent_id && !allIds.has(r.parent_id)) {
      orphanRoots.push({
        id: r.id, nome: r.nome, descricao: r.descricao, parent_id: r.parent_id,
        arquivada: r.arquivada, children: build(r.id), count: counts.get(r.id) ?? 0,
      });
    }
  }
  return [...roots, ...orphanRoots];
}

function TreeNode({
  node, depth, selecionada, expandidas, onSelect, onToggle, onEdit, onCriarSub,
}: {
  node: PastaTree;
  depth: number;
  selecionada: string | null;
  expandidas: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onEdit: (p: PastaRow) => void;
  onCriarSub: (id: string) => void;
}) {
  const qc = useQueryClient();
  const expanded = expandidas.has(node.id);
  const hasChildren = node.children.length > 0;
  const isSelected = selecionada === node.id;

  const arquivar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pastas").update({ arquivada: !node.arquivada }).eq("id", node.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(node.arquivada ? "Pasta restaurada" : "Pasta arquivada");
      qc.invalidateQueries({ queryKey: ["pastas-full"] });
      qc.invalidateQueries({ queryKey: ["pastas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("pastas")
        .insert({
          nome: `${node.nome} (cópia)`,
          descricao: node.descricao,
          parent_id: node.parent_id,
        })
        .select("id")
        .single();
      if (error) throw error;
      // copia vínculos de questões
      const { data: vincs } = await supabase
        .from("questao_pasta").select("questao_id").eq("pasta_id", node.id);
      if (vincs && vincs.length > 0) {
        const rows = vincs.map((v) => ({ pasta_id: data!.id, questao_id: v.questao_id }));
        await supabase.from("questao_pasta").insert(rows);
      }
    },
    onSuccess: () => {
      toast.success("Pasta duplicada");
      qc.invalidateQueries({ queryKey: ["pastas-full"] });
      qc.invalidateQueries({ queryKey: ["pastas"] });
      qc.invalidateQueries({ queryKey: ["questao-pasta-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pastas").delete().eq("id", node.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pasta excluída. Questões mantidas no banco.");
      qc.invalidateQueries({ queryKey: ["pastas-full"] });
      qc.invalidateQueries({ queryKey: ["pastas"] });
      qc.invalidateQueries({ queryKey: ["questao-pasta-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div
        className={`group flex items-center gap-1 pr-1 py-1 rounded text-sm transition ${
          isSelected ? "bg-accent/20" : "hover:bg-muted"
        } ${node.arquivada ? "opacity-60" : ""}`}
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className="w-5 h-5 flex items-center justify-center shrink-0 text-muted-foreground"
        >
          {hasChildren ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <Folder size={14} className="shrink-0 text-primary" />
          <span className="truncate">{node.nome}</span>
          {node.arquivada && <Badge variant="outline" className="text-[10px] h-4">arq.</Badge>}
        </button>
        <span className="text-[10px] text-muted-foreground shrink-0">{node.count}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100">
              <MoreVertical size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onCriarSub(node.id)}>
              <FolderPlus size={14} className="mr-2" /> Nova subpasta
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit({
              id: node.id, nome: node.nome, descricao: node.descricao,
              parent_id: node.parent_id, arquivada: node.arquivada,
            })}>
              <Pencil size={14} className="mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicar.mutate()}>
              <Copy size={14} className="mr-2" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => arquivar.mutate()}>
              {node.arquivada ? (
                <><ArchiveRestore size={14} className="mr-2" /> Desarquivar</>
              ) : (
                <><Archive size={14} className="mr-2" /> Arquivar</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                  <Trash2 size={14} className="mr-2" /> Excluir
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir pasta "{node.nome}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Subpastas viram pastas raiz. As questões permanecem no banco.
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
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((c) => (
            <TreeNode
              key={c.id} node={c} depth={depth + 1}
              selecionada={selecionada} expandidas={expandidas}
              onSelect={onSelect} onToggle={onToggle}
              onEdit={onEdit} onCriarSub={onCriarSub}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- Form (criar / editar) -------------------- */

function PastaFormDialog({
  pasta, parentDefault, todasPastas, onClose, onSaved,
}: {
  pasta: PastaRow | null;
  parentDefault?: string | null;
  todasPastas: PastaRow[];
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const editando = !!pasta;
  const [nome, setNome] = useState(pasta?.nome ?? "");
  const [descricao, setDescricao] = useState(pasta?.descricao ?? "");
  const [parentId, setParentId] = useState<string | null>(
    pasta ? pasta.parent_id : (parentDefault ?? null)
  );

  // Descendentes — não podem ser pai (evita ciclo)
  const descendentes = useMemo(() => {
    if (!pasta) return new Set<string>();
    const set = new Set<string>([pasta.id]);
    let added = true;
    while (added) {
      added = false;
      for (const p of todasPastas) {
        if (p.parent_id && set.has(p.parent_id) && !set.has(p.id)) {
          set.add(p.id);
          added = true;
        }
      }
    }
    return set;
  }, [pasta, todasPastas]);

  const save = useMutation({
    mutationFn: async () => {
      const nomeTrim = nome.trim();
      if (nomeTrim.length < 1) throw new Error("Informe o nome da pasta");
      const payload = {
        nome: nomeTrim,
        descricao: descricao.trim() || null,
        parent_id: parentId,
      };
      if (editando) {
        const { error } = await supabase.from("pastas").update(payload).eq("id", pasta!.id);
        if (error) throw error;
        return pasta!.id;
      } else {
        const { data, error } = await supabase
          .from("pastas").insert(payload).select("id").single();
        if (error) throw error;
        return data!.id;
      }
    },
    onSuccess: (id) => {
      toast.success(editando ? "Pasta atualizada" : "Pasta criada");
      onSaved(id);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? "Editar pasta" : "Nova pasta"}</DialogTitle>
          <DialogDescription>
            Organize as questões em pastas e subpastas para facilitar a montagem de simulados.
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
              placeholder="Opcional"
            />
          </div>
          <div>
            <Label>Pasta pai</Label>
            <Select
              value={parentId ?? "__root__"}
              onValueChange={(v) => setParentId(v === "__root__" ? null : v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">— Sem pasta pai (raiz)</SelectItem>
                {todasPastas
                  .filter((p) => !descendentes.has(p.id))
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
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

/* -------------------- Painel da pasta -------------------- */

function PainelPasta({
  pastaId, pastas, onEdit, onClose,
}: {
  pastaId: string;
  pastas: PastaRow[];
  onEdit: (p: PastaRow) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const pasta = pastas.find((p) => p.id === pastaId);
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const { data: questoes = [], isLoading } = useQuery({
    queryKey: ["pasta-questoes", pastaId],
    queryFn: async () => {
      const { data: vincs, error: e1 } = await supabase
        .from("questao_pasta").select("questao_id").eq("pasta_id", pastaId);
      if (e1) throw e1;
      const ids = (vincs ?? []).map((v) => v.questao_id);
      if (ids.length === 0) return [] as QuestaoMin[];
      const { data, error } = await supabase
        .from("questoes")
        .select("id, codigo_externo, enunciado, disciplina, area, assunto, topico, dificuldade, status")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as QuestaoMin[];
    },
  });

  const subpastas = useMemo(
    () => pastas.filter((p) => p.parent_id === pastaId),
    [pastas, pastaId]
  );

  const filtered = useMemo(() => {
    const s = busca.trim().toLowerCase();
    if (!s) return questoes;
    return questoes.filter((q) =>
      q.enunciado.toLowerCase().includes(s) ||
      (q.codigo_externo ?? "").toLowerCase().includes(s) ||
      (q.disciplina ?? "").toLowerCase().includes(s) ||
      (q.assunto ?? "").toLowerCase().includes(s)
    );
  }, [questoes, busca]);

  function toggle(id: string) {
    setSelecionadas((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selecionadas.size === filtered.length) setSelecionadas(new Set());
    else setSelecionadas(new Set(filtered.map((q) => q.id)));
  }

  const remover = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("questao_pasta").delete()
        .eq("pasta_id", pastaId).in("questao_id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} questão(ões) removida(s) da pasta`);
      setSelecionadas(new Set());
      qc.invalidateQueries({ queryKey: ["pasta-questoes", pastaId] });
      qc.invalidateQueries({ queryKey: ["questao-pasta-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mover = useMutation({
    mutationFn: async ({ ids, destinoId }: { ids: string[]; destinoId: string }) => {
      // remove do origem e insere no destino (upsert)
      await supabase.from("questao_pasta").delete()
        .eq("pasta_id", pastaId).in("questao_id", ids);
      const rows = ids.map((qid) => ({ questao_id: qid, pasta_id: destinoId }));
      const { error } = await supabase
        .from("questao_pasta")
        .upsert(rows, { onConflict: "questao_id,pasta_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`${v.ids.length} questão(ões) movida(s)`);
      setSelecionadas(new Set());
      qc.invalidateQueries({ queryKey: ["pasta-questoes", pastaId] });
      qc.invalidateQueries({ queryKey: ["questao-pasta-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copiar = useMutation({
    mutationFn: async ({ ids, destinoId }: { ids: string[]; destinoId: string }) => {
      const rows = ids.map((qid) => ({ questao_id: qid, pasta_id: destinoId }));
      const { error } = await supabase
        .from("questao_pasta")
        .upsert(rows, { onConflict: "questao_id,pasta_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`${v.ids.length} questão(ões) copiada(s) para outra pasta`);
      setSelecionadas(new Set());
      qc.invalidateQueries({ queryKey: ["questao-pasta-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!pasta) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="text-muted-foreground text-sm">Pasta não encontrada.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FolderOpen size={20} className="text-primary" /> {pasta.nome}
              {pasta.arquivada && <Badge variant="outline">Arquivada</Badge>}
            </h2>
            {pasta.descricao && (
              <p className="text-sm text-muted-foreground mt-1">{pasta.descricao}</p>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span><FileQuestion size={12} className="inline mr-1" />{questoes.length} questões</span>
              <span>· {subpastas.length} subpasta(s)</span>
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => onEdit(pasta)}>
              <Pencil size={14} className="mr-1" /> Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X size={14} />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar questão na pasta..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdicionarQuestoesPopover pastaId={pastaId} />
          {selecionadas.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground ml-2">
                {selecionadas.size} selecionada(s)
              </span>
              <MoverPopover
                pastas={pastas.filter((p) => p.id !== pastaId)}
                onMover={(destinoId) =>
                  mover.mutate({ ids: Array.from(selecionadas), destinoId })
                }
                onCopiar={(destinoId) =>
                  copiar.mutate({ ids: Array.from(selecionadas), destinoId })
                }
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive">
                    <Trash2 size={14} className="mr-1" /> Remover desta pasta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover {selecionadas.size} questão(ões)?</AlertDialogTitle>
                    <AlertDialogDescription>
                      As questões serão desvinculadas desta pasta, mas permanecem no banco.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground"
                      onClick={() => remover.mutate(Array.from(selecionadas))}
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" variant="ghost" onClick={() => setSelecionadas(new Set())}>
                Limpar
              </Button>
            </>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground p-8 text-center">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
            Nenhuma questão nesta pasta ainda.
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selecionadas.size > 0 && selecionadas.size === filtered.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Enunciado</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Dif.</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Checkbox
                        checked={selecionadas.has(q.id)}
                        onCheckedChange={() => toggle(q.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {q.codigo_externo ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[400px]">
                      <p className="truncate text-sm">{stripMarkdown(q.enunciado)}</p>
                    </TableCell>
                    <TableCell className="text-xs">{q.disciplina ?? "—"}</TableCell>
                    <TableCell className="text-xs">{q.assunto ?? q.topico ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {q.dificuldade ? <Badge variant="outline">N{q.dificuldade}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{q.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MoverPopover({
  pastas, onMover, onCopiar,
}: {
  pastas: PastaRow[];
  onMover: (id: string) => void;
  onCopiar: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const filtered = pastas.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase())
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Move size={14} className="mr-1" /> Mover / Copiar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 space-y-2">
        <Input
          placeholder="Buscar pasta..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="max-h-56 overflow-auto">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3">Nenhuma pasta.</p>
          )}
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-1 px-1 py-1 rounded hover:bg-muted">
              <button
                type="button"
                onClick={() => { onMover(p.id); setOpen(false); }}
                className="flex-1 text-left text-sm truncate"
                title="Mover para esta pasta"
              >
                <Folder size={12} className="inline mr-2" />{p.nome}
              </button>
              <Button
                size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => { onCopiar(p.id); setOpen(false); }}
                title="Copiar para esta pasta"
              >
                <Copy size={12} />
              </Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AdicionarQuestoesPopover({ pastaId }: { pastaId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const { data: vincs } = useQuery({
    enabled: open,
    queryKey: ["pasta-questoes-ids", pastaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questao_pasta").select("questao_id").eq("pasta_id", pastaId);
      if (error) throw error;
      return new Set((data ?? []).map((v) => v.questao_id));
    },
  });

  const { data: todas = [] } = useQuery({
    enabled: open,
    queryKey: ["banco-questoes-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questoes")
        .select("id, codigo_externo, enunciado, disciplina")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as { id: string; codigo_externo: string | null; enunciado: string; disciplina: string | null }[];
    },
  });

  const filtered = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return todas.filter((q) => {
      if (vincs?.has(q.id)) return false;
      if (!s) return true;
      return (
        q.enunciado.toLowerCase().includes(s) ||
        (q.codigo_externo ?? "").toLowerCase().includes(s) ||
        (q.disciplina ?? "").toLowerCase().includes(s)
      );
    });
  }, [todas, vincs, busca]);

  const add = useMutation({
    mutationFn: async (ids: string[]) => {
      const rows = ids.map((qid) => ({ questao_id: qid, pasta_id: pastaId }));
      const { error } = await supabase
        .from("questao_pasta")
        .upsert(rows, { onConflict: "questao_id,pasta_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} questão(ões) adicionada(s)`);
      setSel(new Set());
      qc.invalidateQueries({ queryKey: ["pasta-questoes", pastaId] });
      qc.invalidateQueries({ queryKey: ["pasta-questoes-ids", pastaId] });
      qc.invalidateQueries({ queryKey: ["questao-pasta-all"] });
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
        <Button size="sm">
          <Plus size={14} className="mr-1" /> Adicionar questões
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-2 space-y-2">
        <Input
          placeholder="Buscar questão..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="max-h-72 overflow-auto space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">
              Nenhuma questão disponível.
            </p>
          )}
          {filtered.slice(0, 100).map((q) => (
            <label
              key={q.id}
              className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm cursor-pointer"
            >
              <Checkbox
                checked={sel.has(q.id)}
                onCheckedChange={() => toggle(q.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-mono">
                  {q.codigo_externo ?? q.id.slice(0, 8)} · {q.disciplina ?? "—"}
                </p>
                <p className="truncate">{stripMarkdown(q.enunciado)}</p>
              </div>
            </label>
          ))}
          {filtered.length > 100 && (
            <p className="text-xs text-muted-foreground px-2 py-1 text-center">
              Mostrando 100 de {filtered.length}. Refine a busca.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-xs text-muted-foreground">{sel.size} selecionada(s)</span>
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
