import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Markdown, stripMarkdown } from "@/components/ui/markdown";
import { formatBrasilia } from "@/lib/datetime";
import { MessageSquareWarning, CheckCircle2, Circle, Reply } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/feedbacks/")({
  head: () => ({ meta: [{ title: "Feedbacks de questões — Admin" }] }),
  component: FeedbacksPage,
});

type FeedbackTipo = Database["public"]["Enums"]["feedback_tipo"];

const TIPO_LABEL: Record<FeedbackTipo, string> = {
  duvida: "Dúvida",
  erro: "Erro",
  sugestao: "Sugestão",
  elogio: "Elogio",
  reportar_erro: "Reportar erro",
  duplicada: "Duplicada",
  desatualizada: "Desatualizada",
  gabarito_incorreto: "Gabarito incorreto",
  enunciado_confuso: "Enunciado confuso",
  alternativa_incorreta: "Alternativa incorreta",
  comentario_incorreto: "Comentário incorreto",
};

type Row = {
  id: string;
  questao_id: string;
  estudante_id: string | null;
  sessao_id: string | null;
  tipo: FeedbackTipo;
  mensagem: string;
  resposta_admin: string | null;
  resolvido: boolean;
  created_at: string;
  updated_at: string;
  questao?: { id: string; codigo_externo: string | null; enunciado: string } | null;
  estudante?: { id: string; nome: string | null; email: string } | null;
};

function FeedbacksPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendentes" | "resolvidos">("pendentes");
  const [tipoFilter, setTipoFilter] = useState<"todos" | FeedbackTipo>("todos");
  const [search, setSearch] = useState("");
  const [responder, setResponder] = useState<Row | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-feedbacks", statusFilter, tipoFilter],
    queryFn: async () => {
      let q = supabase
        .from("feedbacks_questao")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter === "pendentes") q = q.eq("resolvido", false);
      if (statusFilter === "resolvidos") q = q.eq("resolvido", true);
      if (tipoFilter !== "todos") q = q.eq("tipo", tipoFilter);

      const { data: fb, error } = await q;
      if (error) throw error;

      const questaoIds = Array.from(new Set((fb ?? []).map((f) => f.questao_id)));
      const estudanteIds = Array.from(
        new Set((fb ?? []).map((f) => f.estudante_id).filter(Boolean) as string[])
      );

      const [qs, ests] = await Promise.all([
        questaoIds.length
          ? supabase.from("questoes").select("id, codigo_externo, enunciado").in("id", questaoIds)
          : Promise.resolve({ data: [], error: null }),
        estudanteIds.length
          ? supabase.from("estudantes").select("id, nome, email").in("id", estudanteIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const qMap = new Map((qs.data ?? []).map((x) => [x.id, x]));
      const eMap = new Map((ests.data ?? []).map((x) => [x.id, x]));

      return (fb ?? []).map((f) => ({
        ...f,
        questao: qMap.get(f.questao_id) ?? null,
        estudante: f.estudante_id ? eMap.get(f.estudante_id) ?? null : null,
      })) as Row[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((r) => {
      const enun = stripMarkdown(r.questao?.enunciado ?? "").toLowerCase();
      return (
        r.mensagem.toLowerCase().includes(term) ||
        (r.resposta_admin ?? "").toLowerCase().includes(term) ||
        (r.questao?.codigo_externo ?? "").toLowerCase().includes(term) ||
        enun.includes(term) ||
        (r.estudante?.nome ?? "").toLowerCase().includes(term) ||
        (r.estudante?.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, search]);

  const totalPendentes = (data ?? []).filter((r) => !r.resolvido).length;

  const marcar = useMutation({
    mutationFn: async (vars: { id: string; resolvido: boolean }) => {
      const { error } = await supabase
        .from("feedbacks_questao")
        .update({ resolvido: vars.resolvido })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-feedbacks"] });
      toast.success("Status atualizado.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <MessageSquareWarning size={28} /> Feedbacks de questões
          </h1>
          <p className="text-muted-foreground mt-1">
            Reportes enviados pelos estudantes durante simulados.
            {statusFilter !== "resolvidos" && (
              <> {totalPendentes} pendente{totalPendentes === 1 ? "" : "s"}.</>
            )}
          </p>
        </div>
      </header>

      <Card className="border-secondary/20 mb-6">
        <CardContent className="pt-6 grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendentes">Pendentes</SelectItem>
                <SelectItem value="resolvidos">Resolvidos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v as typeof tipoFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {Object.entries(TIPO_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Buscar</label>
            <Input
              placeholder="Mensagem, código, enunciado, estudante…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum feedback encontrado com esses filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <Card key={f.id} className="border-secondary/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{TIPO_LABEL[f.tipo]}</Badge>
                    {f.resolvido ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                        <CheckCircle2 size={12} className="mr-1" /> Resolvido
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Circle size={12} className="mr-1" /> Pendente
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatBrasilia(f.created_at, "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setResponder(f)}>
                      <Reply size={14} className="mr-1" />
                      {f.resposta_admin ? "Editar resposta" : "Responder"}
                    </Button>
                    <Button
                      size="sm"
                      variant={f.resolvido ? "secondary" : "default"}
                      onClick={() => marcar.mutate({ id: f.id, resolvido: !f.resolvido })}
                      disabled={marcar.isPending}
                    >
                      {f.resolvido ? "Reabrir" : "Marcar resolvido"}
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-sm font-medium mt-2">
                  {f.questao ? (
                    <Link
                      to="/admin/questoes/$id"
                      params={{ id: f.questao.id }}
                      className="hover:underline text-primary"
                    >
                      {f.questao.codigo_externo ? `[${f.questao.codigo_externo}] ` : ""}
                      {stripMarkdown(f.questao.enunciado).slice(0, 140)}
                      {stripMarkdown(f.questao.enunciado).length > 140 ? "…" : ""}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground italic">Questão removida</span>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Por {f.estudante?.nome ?? "—"}{" "}
                  {f.estudante?.email && <span>· {f.estudante.email}</span>}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Mensagem</p>
                  <div className="rounded border border-secondary/20 p-3 bg-muted/30">
                    <Markdown className="text-sm">{f.mensagem}</Markdown>
                  </div>
                </div>
                {f.resposta_admin && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      Resposta do administrador
                    </p>
                    <div className="rounded border border-primary/20 p-3 bg-primary/5">
                      <Markdown className="text-sm">{f.resposta_admin}</Markdown>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ResponderDialog
        feedback={responder}
        onClose={() => setResponder(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-feedbacks"] });
          setResponder(null);
        }}
      />

      <Toaster richColors position="top-right" />
    </div>
  );
}

function ResponderDialog({
  feedback, onClose, onSaved,
}: {
  feedback: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [resolver, setResolver] = useState(true);

  // sync on open
  useEffect(() => {
    if (feedback) {
      setText(feedback.resposta_admin ?? "");
      setResolver(!feedback.resolvido);
    }
  }, [feedback]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!feedback) return;
      const { error } = await supabase
        .from("feedbacks_questao")
        .update({
          resposta_admin: text.trim() ? text.trim() : null,
          resolvido: resolver ? true : feedback.resolvido,
        })
        .eq("id", feedback.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resposta enviada.");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={!!feedback} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Responder feedback</DialogTitle>
          <DialogDescription>
            Sua resposta ficará visível na página da questão para o estudante.
            Aceita formatação Markdown.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Ex.: Obrigado pelo reporte. A questão foi corrigida..."
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={resolver}
            onChange={(e) => setResolver(e.target.checked)}
          />
          Marcar como resolvido ao salvar
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar resposta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
