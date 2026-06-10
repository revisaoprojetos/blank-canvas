import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, FolderInput } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMemo, useState } from "react";
import { ImportarQuestoes } from "@/components/questoes/ImportarQuestoes";
import { stripMarkdown } from "@/components/ui/markdown";
import { PastasSidebar, usePastas } from "@/components/pastas/PastasSidebar";

export const Route = createFileRoute("/_authenticated/admin/questoes/")({
  head: () => ({ meta: [{ title: "Questões — Painel Admin" }] }),
  component: QuestoesList,
});

type Questao = {
  id: string;
  enunciado: string;
  disciplina: string | null;
  area: string | null;
  topico: string | null;
  dificuldade: number | null;
  ativa: boolean;
  created_at: string;
  pasta_id: string | null;
};

function QuestoesList() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pastaSel, setPastaSel] = useState<"todas" | "sem_pasta" | string>("todas");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [moverPara, setMoverPara] = useState<string>("");

  const { data: questoes, isLoading } = useQuery({
    queryKey: ["questoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Questao[];
    },
  });

  const { data: pastas = [] } = usePastas();

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: 0, sem_pasta: 0 };
    (questoes ?? []).forEach((x) => {
      c.todas++;
      if (!x.pasta_id) c.sem_pasta++;
      else c[x.pasta_id] = (c[x.pasta_id] ?? 0) + 1;
    });
    return c;
  }, [questoes]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("alternativas").delete().eq("questao_id", id);
      const { error } = await supabase.from("questoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Questão excluída");
      qc.invalidateQueries({ queryKey: ["questoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mover = useMutation({
    mutationFn: async ({ ids, pasta_id }: { ids: string[]; pasta_id: string | null }) => {
      const { error } = await supabase
        .from("questoes")
        .update({ pasta_id })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`${vars.ids.length} questão(ões) movida(s)`);
      setSelecionadas(new Set());
      qc.invalidateQueries({ queryKey: ["questoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (questoes ?? []).filter((x) => {
    if (pastaSel === "sem_pasta" && x.pasta_id) return false;
    if (pastaSel !== "todas" && pastaSel !== "sem_pasta" && x.pasta_id !== pastaSel) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      x.enunciado.toLowerCase().includes(s) ||
      (x.disciplina ?? "").toLowerCase().includes(s) ||
      (x.topico ?? "").toLowerCase().includes(s)
    );
  });

  function toggle(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selecionadas.size === filtered.length) setSelecionadas(new Set());
    else setSelecionadas(new Set(filtered.map((x) => x.id)));
  }

  function executarMover() {
    if (selecionadas.size === 0 || !moverPara) return;
    const pasta_id = moverPara === "__sem__" ? null : moverPara;
    mover.mutate({ ids: Array.from(selecionadas), pasta_id });
    setMoverPara("");
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Toaster />
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Questões</h1>
          <p className="text-muted-foreground mt-1">Banco de questões da plataforma.</p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/admin/questoes/novo">
            <Plus className="mr-2" size={16} /> Nova questão
          </Link>
        </Button>
      </header>

      <div className="mb-6">
        <ImportarQuestoes onConcluido={() => qc.invalidateQueries({ queryKey: ["questoes"] })} />
      </div>

      <div className="flex gap-6">
        <PastasSidebar selecao={pastaSel} onSelecionar={(s) => { setPastaSel(s); setSelecionadas(new Set()); }} counts={counts} />

        <div className="flex-1 min-w-0">
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Buscar por enunciado, disciplina ou tópico..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center gap-3 mb-3 p-2 border border-secondary/20 rounded-md bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selecionadas.size > 0 && selecionadas.size === filtered.length}
                  onCheckedChange={toggleAll}
                />
                <span className="text-xs text-muted-foreground">
                  {selecionadas.size > 0
                    ? `${selecionadas.size} selecionada(s)`
                    : `Selecionar todas (${filtered.length})`}
                </span>
              </div>
              {selecionadas.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <FolderInput size={14} className="text-muted-foreground" />
                  <Select value={moverPara} onValueChange={setMoverPara}>
                    <SelectTrigger className="h-8 w-56">
                      <SelectValue placeholder="Mover para pasta..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__sem__">Sem pasta</SelectItem>
                      {pastas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={executarMover} disabled={!moverPara || mover.isPending}>
                    Mover
                  </Button>
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-secondary/40">
              <p className="text-muted-foreground mb-4">
                {q ? "Nenhuma questão encontrada." : "Nenhuma questão nesta pasta."}
              </p>
              {!q && pastaSel === "todas" && (
                <Button asChild>
                  <Link to="/admin/questoes/novo">Criar primeira questão</Link>
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((x) => {
                const pastaNome = pastas.find((p) => p.id === x.pasta_id)?.nome;
                return (
                  <Card key={x.id} className="p-4 border-secondary/20 hover:border-secondary/50 transition">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        className="mt-1"
                        checked={selecionadas.has(x.id)}
                        onCheckedChange={() => toggle(x.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground line-clamp-2 mb-2">{stripMarkdown(x.enunciado)}</p>
                        <div className="flex flex-wrap gap-2">
                          {pastaNome && <Badge className="bg-primary/10 text-primary">📁 {pastaNome}</Badge>}
                          {x.disciplina && <Badge variant="secondary">{x.disciplina}</Badge>}
                          {x.topico && <Badge variant="outline">{x.topico}</Badge>}
                          {x.dificuldade && (
                            <Badge className="bg-accent/20 text-accent-foreground">Nível {x.dificuldade}</Badge>
                          )}
                          {!x.ativa && <Badge variant="destructive">Inativa</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/admin/questoes/$id" params={{ id: x.id }}>
                            <Pencil size={14} />
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir questão?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação remove a questão e suas alternativas. Não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => remove.mutate(x.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
