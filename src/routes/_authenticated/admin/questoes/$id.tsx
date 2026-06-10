import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QuestaoForm, type QuestaoFormData } from "@/components/questoes/QuestaoForm";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/admin/questoes/$id")({
  head: () => ({ meta: [{ title: "Editar questão — Painel Admin" }] }),
  component: EditQuestao,
});

function EditQuestao() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["questao", id],
    queryFn: async () => {
      const { data: q, error: e1 } = await supabase
        .from("questoes").select("*").eq("id", id).single();
      if (e1) throw e1;
      const { data: alts, error: e2 } = await supabase
        .from("alternativas").select("*").eq("questao_id", id).order("letra");
      if (e2) throw e2;
      const correta = alts.find((a) => a.correta);
      const initial: Partial<QuestaoFormData> = {
        enunciado: q.enunciado,
        disciplina: q.disciplina ?? "",
        area: q.area ?? "",
        topico: q.topico ?? "",
        dificuldade: q.dificuldade ?? 3,
        fonte: q.fonte ?? "",
        explicacao: q.explicacao ?? "",
        ativa: q.ativa,
        pasta_id: q.pasta_id ?? null,
        alternativas: alts.map((a) => ({ letra: a.letra, texto: a.texto })),
        corretaLetra: correta?.letra ?? "A",
      };
      return initial;
    },
  });

  if (isLoading) return <div className="p-8">Carregando...</div>;
  if (error) return <div className="p-8 text-destructive">Erro: {(error as Error).message}</div>;

  return (
    <>
      <Toaster />
      <QuestaoForm id={id} initial={data} />
    </>
  );
}
