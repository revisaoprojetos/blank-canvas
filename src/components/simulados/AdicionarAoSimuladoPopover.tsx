import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ClipboardList, Search, UserPlus, FilePlus2 } from "lucide-react";
import { toast } from "sonner";

type SimuladoMin = { id: string; titulo: string; status: string };

type Props = {
  mode: "questoes" | "estudantes";
  ids: string[];
  onSuccess?: () => void;
};

const STATUS_TONE: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  agendado: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  em_andamento: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  finalizado: "bg-secondary text-secondary-foreground",
  cancelado: "bg-destructive/15 text-destructive border-destructive/30",
};

export function AdicionarAoSimuladoPopover({ mode, ids, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const { data: simulados = [], isLoading } = useQuery({
    enabled: open,
    queryKey: ["simulados-bulk-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulados")
        .select("id, titulo, status")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SimuladoMin[];
    },
  });

  const filtrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return simulados;
    return simulados.filter((s) => s.titulo.toLowerCase().includes(term));
  }, [simulados, busca]);

  const exec = useMutation({
    mutationFn: async (simuladoId: string) => {
      if (ids.length === 0) throw new Error("Nada selecionado.");

      if (mode === "questoes") {
        // dedupe contra os já vinculados
        const { data: existentes, error: e1 } = await supabase
          .from("questao_simulado")
          .select("questao_id, ordem")
          .eq("simulado_id", simuladoId);
        if (e1) throw e1;
        const jaVinc = new Set((existentes ?? []).map((r) => r.questao_id));
        const novos = ids.filter((qid) => !jaVinc.has(qid));
        const dup = ids.length - novos.length;
        if (novos.length === 0) {
          throw new Error(
            dup > 0
              ? `Todas as ${ids.length} questão(ões) já estão neste simulado.`
              : "Nada para adicionar.",
          );
        }
        const maxOrdem = (existentes ?? []).reduce(
          (m, r) => Math.max(m, r.ordem ?? 0),
          0,
        );
        const rows = novos.map((qid, i) => ({
          simulado_id: simuladoId,
          questao_id: qid,
          ordem: maxOrdem + i + 1,
          peso: 1,
        }));
        const { error } = await supabase.from("questao_simulado").insert(rows);
        if (error) throw error;
        return { adicionadas: novos.length, duplicadas: dup };
      }

      // mode === "estudantes"
      const rows = ids.map((estudante_id) => ({
        estudante_id,
        simulado_id: simuladoId,
        liberado: true,
      }));
      const { error } = await supabase
        .from("matriculas")
        .upsert(rows, {
          onConflict: "estudante_id,simulado_id",
          ignoreDuplicates: true,
        });
      if (error) throw error;
      return { adicionadas: rows.length, duplicadas: 0 };
    },
    onSuccess: ({ adicionadas, duplicadas }) => {
      toast.success(
        mode === "questoes"
          ? `${adicionadas} questão(ões) adicionada(s)${duplicadas ? `. ${duplicadas} já estavam vinculadas.` : "."}`
          : `${adicionadas} estudante(s) matriculado(s) (duplicatas ignoradas).`,
      );
      setOpen(false);
      onSuccess?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const Icon = mode === "questoes" ? FilePlus2 : UserPlus;
  const label =
    mode === "questoes" ? "Adicionar ao simulado" : "Matricular em simulado";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm">
          <Icon size={14} className="mr-1" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2 space-y-2">
        <p className="text-xs text-muted-foreground px-2 pt-1 flex items-center gap-1">
          <ClipboardList size={12} /> Escolha o simulado
        </p>
        <div className="relative px-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Buscar simulado..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-auto">
          {isLoading ? (
            <p className="text-xs text-muted-foreground px-2 py-3">Carregando…</p>
          ) : filtrados.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-3">
              Nenhum simulado encontrado.
            </p>
          ) : (
            filtrados.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={exec.isPending}
                onClick={() => exec.mutate(s.id)}
                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted flex items-center justify-between gap-2 disabled:opacity-50"
              >
                <span className="truncate">{s.titulo}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${STATUS_TONE[s.status] ?? ""}`}
                >
                  {s.status}
                </Badge>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
