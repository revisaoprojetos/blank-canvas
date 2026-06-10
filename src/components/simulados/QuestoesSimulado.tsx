import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Folder, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { stripMarkdown } from "@/components/ui/markdown";
import { usePastas } from "@/components/pastas/PastasSidebar";

type VinculoRow = {
  id: string;
  ordem: number;
  peso: number;
  questao_id: string;
  questoes: {
    id: string;
    enunciado: string;
    disciplina: string | null;
    topico: string | null;
    ativa: boolean;
  } | null;
};

type QuestaoDisponivel = {
  id: string;
  enunciado: string;
  disciplina: string | null;
  topico: string | null;
};

export function QuestoesSimulado({ simuladoId }: { simuladoId: string }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [openPasta, setOpenPasta] = useState(false);
  const [pastaSelecionada, setPastaSelecionada] = useState<string>("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const { data: pastas = [] } = usePastas();

  const { data: vinculos = [], isLoading } = useQuery({
    queryKey: ["questao_simulado", simuladoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questao_simulado")
        .select("id, ordem, peso, questao_id, questoes(id, enunciado, disciplina, topico, ativa)")
        .eq("simulado_id", simuladoId)
        .order("ordem");
      if (error) throw error;
      return data as unknown as VinculoRow[];
    },
  });

  // Valida ordens/pesos via RPC (espelha a regra do trigger no servidor)
  const { data: problemas = [] } = useQuery({
    queryKey: ["validar_questoes_simulado", simuladoId, vinculos.length],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("validar_questoes_simulado", {
        _simulado_id: simuladoId,
      });
      if (error) throw error;
      return (data ?? []) as { problema: string; detalhe: string }[];
    },
  });

  // Validações também no cliente (defesa em profundidade)
  const problemasCliente = useMemo(() => {
    const list: { problema: string; detalhe: string }[] = [];
    if (vinculos.length === 0) return list;
    const ordens = vinculos.map((v) => v.ordem).sort((a, b) => a - b);
    const set = new Set(ordens);
    if (set.size !== ordens.length) {
      list.push({ problema: "ordem_duplicada", detalhe: "Há ordens repetidas." });
    }
    for (let i = 0; i < ordens.length; i++) {
      if (ordens[i] !== i + 1) {
        list.push({
          problema: "lacuna_na_ordem",
          detalhe: `Esperava ordem ${i + 1}, encontrei ${ordens[i]}.`,
        });
        break;
      }
    }
    if (vinculos.some((v) => !v.peso || Number(v.peso) <= 0)) {
      list.push({ problema: "peso_invalido", detalhe: "Há vínculos com peso ≤ 0." });
    }
    return list;
  }, [vinculos]);

  const todosProblemas = [...problemasCliente, ...problemas];
  const valido = todosProblemas.length === 0;

  const idsVinculados = new Set(vinculos.map((v) => v.questao_id));

  const { data: disponiveis = [] } = useQuery({
    queryKey: ["questoes_disponiveis", simuladoId, busca],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("questoes")
        .select("id, enunciado, disciplina, topico")
        .eq("ativa", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (busca.trim()) {
        q = q.or(
          `enunciado.ilike.%${busca}%,disciplina.ilike.%${busca}%,topico.ilike.%${busca}%`
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as QuestaoDisponivel[]).filter((x) => !idsVinculados.has(x.id));
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["questao_simulado", simuladoId] });
    qc.invalidateQueries({ queryKey: ["validar_questoes_simulado", simuladoId] });
  };

  // Reescreve TODAS as ordens para 1..N usando 2 passos (alto -> definitivo)
  // para garantir consistência mesmo com UNIQUE(simulado_id, ordem).
  async function reescreverOrdens(lista: VinculoRow[]) {
    const OFFSET = 100000;
    // Passo 1: mover todos para uma faixa alta única
    for (let i = 0; i < lista.length; i++) {
      const { error } = await supabase
        .from("questao_simulado")
        .update({ ordem: OFFSET + i + 1 })
        .eq("id", lista[i].id);
      if (error) throw error;
    }
    // Passo 2: aplicar ordens finais 1..N
    for (let i = 0; i < lista.length; i++) {
      const { error } = await supabase
        .from("questao_simulado")
        .update({ ordem: i + 1 })
        .eq("id", lista[i].id);
      if (error) throw error;
    }
  }

  // Valida uma proposta de reordenação ANTES de enviar
  function validarProposta(lista: VinculoRow[]): string | null {
    if (lista.length === 0) return null;
    const ordens = lista.map((_, i) => i + 1);
    const set = new Set(ordens);
    if (set.size !== ordens.length) return "Ordens duplicadas detectadas.";
    if (Math.min(...ordens) !== 1) return "A ordem deve começar em 1.";
    if (Math.max(...ordens) !== lista.length) return "Há lacunas na ordem.";
    if (lista.some((v) => !v.peso || Number(v.peso) <= 0))
      return "Há vínculos com peso ≤ 0.";
    return null;
  }

  const adicionar = useMutation({
    mutationFn: async (ids: string[]) => {
      const maxOrdem = vinculos.reduce((m, v) => Math.max(m, v.ordem), 0);
      const rows = ids.map((qid, i) => ({
        simulado_id: simuladoId,
        questao_id: qid,
        ordem: maxOrdem + i + 1,
        peso: 1,
      }));
      const { error } = await supabase.from("questao_simulado").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Questões adicionadas");
      setSelecionadas(new Set());
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adicionarPasta = useMutation({
    mutationFn: async (pastaId: string) => {
      // Busca todas as questões ativas da pasta
      const { data: questoesPasta, error } = await supabase
        .from("questoes")
        .select("id")
        .eq("pasta_id", pastaId)
        .eq("ativa", true);
      if (error) throw error;
      const todos = (questoesPasta ?? []).map((x) => x.id);
      if (todos.length === 0) throw new Error("A pasta não tem questões ativas.");

      // Remove duplicatas: questões já vinculadas ao simulado
      const novos = todos.filter((qid) => !idsVinculados.has(qid));
      const duplicadas = todos.length - novos.length;

      if (novos.length === 0) {
        throw new Error(
          `Todas as ${todos.length} questão(ões) da pasta já estão no simulado.`,
        );
      }

      const maxOrdem = vinculos.reduce((m, v) => Math.max(m, v.ordem), 0);
      const rows = novos.map((qid, i) => ({
        simulado_id: simuladoId,
        questao_id: qid,
        ordem: maxOrdem + i + 1,
        peso: 1,
      }));
      const { error: e2 } = await supabase.from("questao_simulado").insert(rows);
      if (e2) throw e2;

      return { adicionadas: novos.length, duplicadas };
    },
    onSuccess: ({ adicionadas, duplicadas }) => {
      toast.success(
        duplicadas > 0
          ? `${adicionadas} adicionada(s). ${duplicadas} duplicada(s) ignorada(s).`
          : `${adicionadas} questão(ões) adicionada(s).`,
      );
      setOpenPasta(false);
      setPastaSelecionada("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const restantes = vinculos.filter((v) => v.id !== id);
      const erro = validarProposta(restantes.map((v, i) => ({ ...v, ordem: i + 1 })));
      if (erro) throw new Error(erro);
      const { error } = await supabase.from("questao_simulado").delete().eq("id", id);
      if (error) throw error;
      await reescreverOrdens(restantes);
    },
    onSuccess: () => {
      toast.success("Questão removida");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarPeso = useMutation({
    mutationFn: async ({ id, peso }: { id: string; peso: number }) => {
      if (!peso || peso <= 0) throw new Error("Peso deve ser maior que 0.");
      const { error } = await supabase.from("questao_simulado").update({ peso }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const mover = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const target = index + dir;
      if (target < 0 || target >= vinculos.length) return;

      // Constrói a nova ordem em memória e valida ANTES de tocar no banco
      const nova = [...vinculos];
      [nova[index], nova[target]] = [nova[target], nova[index]];
      const erro = validarProposta(nova.map((v, i) => ({ ...v, ordem: i + 1 })));
      if (erro) throw new Error(`Reordenação inválida: ${erro}`);

      // Atualização otimista para feedback imediato
      qc.setQueryData<VinculoRow[]>(["questao_simulado", simuladoId], () =>
        nova.map((v, i) => ({ ...v, ordem: i + 1 }))
      );

      await reescreverOrdens(nova);
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      toast.error(e.message);
      invalidate(); // reverte otimista
    },
  });

  function toggleSelecionada(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Questões do simulado ({vinculos.length})</CardTitle>
            {valido && vinculos.length > 0 && (
              <span className="text-xs text-accent-foreground bg-accent/20 px-2 py-0.5 rounded">
                ✓ pronto para publicar
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={openPasta} onOpenChange={setOpenPasta}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Folder size={14} className="mr-1" /> Adicionar pasta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar todas as questões de uma pasta</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Todas as questões ativas da pasta serão adicionadas. Questões duplicadas
                  (já vinculadas ao simulado) serão ignoradas automaticamente.
                </p>
                <Select value={pastaSelecionada} onValueChange={setPastaSelecionada}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma pasta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pastas.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">Nenhuma pasta criada.</div>
                    ) : (
                      pastas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button
                    onClick={() => pastaSelecionada && adicionarPasta.mutate(pastaSelecionada)}
                    disabled={!pastaSelecionada || adicionarPasta.isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {adicionarPasta.isPending ? "Adicionando..." : "Adicionar pasta"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus size={14} className="mr-1" /> Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Adicionar questões ao simulado</DialogTitle>
              </DialogHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Buscar por enunciado, disciplina, tópico..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2 mt-2">
                {disponiveis.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma questão disponível.
                  </p>
                ) : (
                  disponiveis.map((q) => {
                    const sel = selecionadas.has(q.id);
                    return (
                      <div
                        key={q.id}
                        onClick={() => toggleSelecionada(q.id)}
                        className={`p-3 border rounded-md cursor-pointer transition ${
                          sel
                            ? "border-accent bg-accent/10"
                            : "border-secondary/20 hover:border-secondary/50"
                        }`}
                      >
                        <p className="text-sm line-clamp-2">{stripMarkdown(q.enunciado)}</p>
                        <div className="flex gap-2 mt-2">
                          {q.disciplina && <Badge variant="secondary">{q.disciplina}</Badge>}
                          {q.topico && <Badge variant="outline">{q.topico}</Badge>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button
                  onClick={() => adicionar.mutate(Array.from(selecionadas))}
                  disabled={selecionadas.size === 0 || adicionar.isPending}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  Adicionar {selecionadas.size > 0 ? `(${selecionadas.size})` : ""}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {todosProblemas.length > 0 && (
          <div className="mb-4 border border-destructive/40 bg-destructive/10 rounded-md p-3 text-sm">
            <p className="font-semibold text-destructive mb-1">
              Há problemas que impedem a publicação:
            </p>
            <ul className="list-disc list-inside text-destructive/90 space-y-0.5">
              {todosProblemas.map((p, i) => (
                <li key={i}>{p.detalhe}</li>
              ))}
            </ul>
          </div>
        )}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : vinculos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma questão vinculada. Clique em "Adicionar" para começar.
          </p>
        ) : (
          <div className="space-y-2">
            {vinculos.map((v, i) => (
              <div
                key={v.id}
                className="flex items-start gap-3 p-3 border border-secondary/20 rounded-md"
              >
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={i === 0 || mover.isPending}
                    onClick={() => mover.mutate({ index: i, dir: -1 })}
                  >
                    <ArrowUp size={12} />
                  </Button>
                  <span className="text-xs text-center font-bold text-primary">{v.ordem}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={i === vinculos.length - 1 || mover.isPending}
                    onClick={() => mover.mutate({ index: i, dir: 1 })}
                  >
                    <ArrowDown size={12} />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2">
                    {v.questoes ? stripMarkdown(v.questoes.enunciado) : "[questão removida]"}
                  </p>
                  <div className="flex gap-2 mt-1">
                    {v.questoes?.disciplina && (
                      <Badge variant="secondary">{v.questoes.disciplina}</Badge>
                    )}
                    {v.questoes?.topico && <Badge variant="outline">{v.questoes.topico}</Badge>}
                    {v.questoes && !v.questoes.ativa && (
                      <Badge variant="destructive">Inativa</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <label className="text-xs text-muted-foreground">Peso</label>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    defaultValue={v.peso}
                    onBlur={(e) => {
                      const peso = Number(e.target.value);
                      if (peso > 0 && peso !== v.peso)
                        atualizarPeso.mutate({ id: v.id, peso });
                    }}
                    className="w-20 h-8"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => remover.mutate(v.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
