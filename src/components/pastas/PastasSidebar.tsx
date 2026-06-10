import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, FolderPlus, Inbox, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type Pasta = {
  id: string;
  nome: string;
  descricao: string | null;
};

export function usePastas() {
  return useQuery({
    queryKey: ["pastas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pastas")
        .select("id, nome, descricao")
        .order("nome");
      if (error) throw error;
      return data as Pasta[];
    },
  });
}

type Selecao = "todas" | "sem_pasta" | string;

export function PastasSidebar({
  selecao,
  onSelecionar,
  counts,
}: {
  selecao: Selecao;
  onSelecionar: (s: Selecao) => void;
  counts?: Record<string, number>;
}) {
  const qc = useQueryClient();
  const { data: pastas = [], isLoading } = usePastas();
  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");

  const criar = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("pastas").insert({ nome });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoNome("");
      toast.success("Pasta criada");
      qc.invalidateQueries({ queryKey: ["pastas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renomear = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("pastas").update({ nome }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditandoId(null);
      toast.success("Pasta renomeada");
      qc.invalidateQueries({ queryKey: ["pastas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pastas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pasta excluída. As questões foram mantidas em 'Sem pasta'.");
      qc.invalidateQueries({ queryKey: ["pastas"] });
      qc.invalidateQueries({ queryKey: ["questoes"] });
      onSelecionar("todas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <aside className="w-64 shrink-0 border-r border-secondary/20 pr-4">
      <div className="flex items-center gap-2 mb-3">
        <Folder size={16} className="text-primary" />
        <h2 className="font-semibold text-sm">Pastas</h2>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (novoNome.trim()) criar.mutate(novoNome.trim());
        }}
        className="flex gap-1 mb-3"
      >
        <Input
          placeholder="Nova pasta..."
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="h-8 text-sm"
        />
        <Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0" disabled={!novoNome.trim() || criar.isPending}>
          <FolderPlus size={14} />
        </Button>
      </form>

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onSelecionar("todas")}
          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition ${
            selecao === "todas" ? "bg-accent/20 text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <Inbox size={14} /> Todas
          </span>
          {counts?.todas !== undefined && (
            <span className="text-xs text-muted-foreground">{counts.todas}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelecionar("sem_pasta")}
          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition ${
            selecao === "sem_pasta" ? "bg-accent/20 text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <Folder size={14} /> Sem pasta
          </span>
          {counts?.sem_pasta !== undefined && (
            <span className="text-xs text-muted-foreground">{counts.sem_pasta}</span>
          )}
        </button>

        {isLoading && <p className="text-xs text-muted-foreground px-2">Carregando...</p>}

        {pastas.map((p) => {
          const editando = editandoId === p.id;
          return (
            <div
              key={p.id}
              className={`group flex items-center gap-1 px-2 py-1 rounded text-sm transition ${
                selecao === p.id ? "bg-accent/20 text-accent-foreground" : "hover:bg-muted"
              }`}
            >
              {editando ? (
                <>
                  <Input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                  />
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                    onClick={() => editNome.trim() && renomear.mutate({ id: p.id, nome: editNome.trim() })}
                  >
                    <Check size={12} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditandoId(null)}>
                    <X size={12} />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onSelecionar(p.id)}
                    className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Folder size={14} /> <span className="truncate">{p.nome}</span>
                    </span>
                    {counts?.[p.id] !== undefined && (
                      <span className="text-xs text-muted-foreground">{counts[p.id]}</span>
                    )}
                  </button>
                  <div className="opacity-0 group-hover:opacity-100 flex shrink-0">
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditandoId(p.id);
                        setEditNome(p.nome);
                      }}
                    >
                      <Pencil size={11} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive">
                          <Trash2 size={11} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir pasta "{p.nome}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            As questões dentro dela serão mantidas no banco, mas ficarão sem pasta.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => excluir.mutate(p.id)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
