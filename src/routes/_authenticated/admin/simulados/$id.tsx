import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import {
  SimuladoBasicSection,
  SimuladoRulesSection,
  useSimuladoFormState,
  type SimuladoFormData,
} from "@/components/simulados/SimuladoForm";
import { QuestoesSimulado } from "@/components/simulados/QuestoesSimulado";
import { MatriculasSimulado } from "@/components/simulados/MatriculasSimulado";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Eye, Save } from "lucide-react";
import { toBrasiliaInput } from "@/lib/datetime";

export const Route = createFileRoute("/_authenticated/admin/simulados/$id")({
  head: () => ({ meta: [{ title: "Editar simulado — Painel Admin" }] }),
  component: EditarSimulado,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Simulado não encontrado.</div>,
});

function EditarSimulado() {
  const { id } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["simulado", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("simulados").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando...</div>;
  if (error || !data) return <div className="p-8 text-destructive">Erro ao carregar.</div>;

  const initial: Partial<SimuladoFormData> = {
    titulo: data.titulo,
    descricao: data.descricao ?? "",
    instrucoes: data.instrucoes ?? "",
    duracao_minutos: data.duracao_minutos,
    data_inicio: toBrasiliaInput(data.data_inicio),
    data_fim: toBrasiliaInput(data.data_fim),
    embaralhar_questoes: data.embaralhar_questoes,
    embaralhar_alternativas: data.embaralhar_alternativas,
    permitir_revisao: data.permitir_revisao,
    mostrar_gabarito: data.mostrar_gabarito,
    mostrar_resultado: (data as { mostrar_resultado?: boolean }).mostrar_resultado ?? true,
    permitir_retentativa: (data as { permitir_retentativa?: boolean }).permitir_retentativa ?? false,
    mostrar_feedbacks: (data as { mostrar_feedbacks?: boolean }).mostrar_feedbacks ?? true,
    solicitar_nome: (data as { solicitar_nome?: boolean }).solicitar_nome ?? true,
    solicitar_cpf: (data as { solicitar_cpf?: boolean }).solicitar_cpf ?? true,
    solicitar_telefone: (data as { solicitar_telefone?: boolean }).solicitar_telefone ?? false,
    permitir_atraso_entrada: (data as { permitir_atraso_entrada?: boolean }).permitir_atraso_entrada ?? true,
    tempo_maximo_atraso_minutos: (data as { tempo_maximo_atraso_minutos?: number }).tempo_maximo_atraso_minutos ?? 30,
    exibir_popup_atraso: (data as { exibir_popup_atraso?: boolean }).exibir_popup_atraso ?? true,
    tempo_popup_atraso_minutos: (data as { tempo_popup_atraso_minutos?: number }).tempo_popup_atraso_minutos ?? 5,
  };

  return <EditarSimuladoInner id={id} initial={initial} titulo={data.titulo} />;
}

function EditarSimuladoInner({
  id, initial, titulo,
}: { id: string; initial: Partial<SimuladoFormData>; titulo: string }) {
  const { form, setForm, duracaoLabel, submit, isPending } = useSimuladoFormState(id, initial);

  return (
    <>
      <Toaster />
      <div className="w-full px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <Link
              to="/admin/simulados"
              className="inline-flex items-center text-sm text-secondary hover:underline mb-1"
            >
              <ArrowLeft size={14} className="mr-1" /> Voltar
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-primary truncate">
              {titulo || "Editar simulado"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/simulados/$id/simulacao" params={{ id }}>
                <Eye size={14} className="mr-1" /> Prévia
              </Link>
            </Button>
            <Button
              onClick={submit}
              disabled={isPending}
              size="sm"
              className="bg-primary hover:bg-primary/90"
            >
              <Save size={14} className="mr-1" />
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="edicao" className="w-full">
          <TabsList>
            <TabsTrigger value="edicao">Edição</TabsTrigger>
            <TabsTrigger value="regras">Regras de aplicação</TabsTrigger>
            <TabsTrigger value="questoes">Questões</TabsTrigger>
            <TabsTrigger value="estudantes">Estudantes</TabsTrigger>
          </TabsList>

          <TabsContent value="edicao" className="mt-6">
            <SimuladoBasicSection form={form} setForm={setForm} duracaoLabel={duracaoLabel} />
          </TabsContent>

          <TabsContent value="regras" className="mt-6">
            <SimuladoRulesSection form={form} setForm={setForm} />
          </TabsContent>

          <TabsContent value="questoes" className="mt-6">
            <QuestoesSimulado simuladoId={id} />
          </TabsContent>

          <TabsContent value="estudantes" className="mt-6">
            <MatriculasSimulado simuladoId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
