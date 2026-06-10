import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { brasiliaInputToISO } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export type SimuladoFormData = {
  titulo: string;
  descricao: string;
  instrucoes: string;
  duracao_minutos: number;
  data_inicio: string;
  data_fim: string;
  embaralhar_questoes: boolean;
  embaralhar_alternativas: boolean;
  permitir_revisao: boolean;
  mostrar_gabarito: boolean;
  mostrar_resultado: boolean;
  permitir_retentativa: boolean;
  mostrar_feedbacks: boolean;
  solicitar_nome: boolean;
  solicitar_cpf: boolean;
  solicitar_telefone: boolean;
  permitir_atraso_entrada: boolean;
  tempo_maximo_atraso_minutos: number;
  exibir_popup_atraso: boolean;
  tempo_popup_atraso_minutos: number;
};

const EMPTY: SimuladoFormData = {
  titulo: "",
  descricao: "",
  instrucoes: "",
  duracao_minutos: 60,
  data_inicio: "",
  data_fim: "",
  embaralhar_questoes: false,
  embaralhar_alternativas: false,
  permitir_revisao: true,
  mostrar_gabarito: true,
  mostrar_resultado: true,
  permitir_retentativa: false,
  mostrar_feedbacks: true,
  solicitar_nome: true,
  solicitar_cpf: true,
  solicitar_telefone: false,
  permitir_atraso_entrada: true,
  tempo_maximo_atraso_minutos: 30,
  exibir_popup_atraso: true,
  tempo_popup_atraso_minutos: 5,
};

export function useSimuladoFormState(id: string | undefined, initial?: Partial<SimuladoFormData>) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<SimuladoFormData>({ ...EMPTY, ...initial });

  useEffect(() => {
    if (initial) setForm({ ...EMPTY, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Duração calculada automaticamente
  useEffect(() => {
    if (!form.data_inicio || !form.data_fim) return;
    const ini = new Date(`${form.data_inicio}:00-03:00`).getTime();
    const fim = new Date(`${form.data_fim}:00-03:00`).getTime();
    if (Number.isNaN(ini) || Number.isNaN(fim) || fim <= ini) return;
    const minutos = Math.round((fim - ini) / 60_000);
    if (minutos !== form.duracao_minutos) {
      setForm((f) => ({ ...f, duracao_minutos: minutos }));
    }
  }, [form.data_inicio, form.data_fim]);

  const duracaoLabel = useMemo(() => {
    const horas = Math.floor((form.duracao_minutos || 0) / 60);
    const mins = (form.duracao_minutos || 0) % 60;
    return form.duracao_minutos > 0
      ? `${horas > 0 ? `${horas}h ` : ""}${mins}min`
      : "Defina início e fim para calcular";
  }, [form.duracao_minutos]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: form.titulo,
        descricao: form.descricao || null,
        instrucoes: form.instrucoes || null,
        duracao_minutos: form.duracao_minutos,
        data_inicio: form.data_inicio ? brasiliaInputToISO(form.data_inicio) : null,
        data_fim: form.data_fim ? brasiliaInputToISO(form.data_fim) : null,
        embaralhar_questoes: form.embaralhar_questoes,
        embaralhar_alternativas: form.embaralhar_alternativas,
        permitir_revisao: form.permitir_revisao,
        mostrar_gabarito: form.mostrar_gabarito,
        mostrar_resultado: form.mostrar_resultado,
        permitir_retentativa: form.permitir_retentativa,
        mostrar_feedbacks: form.mostrar_feedbacks,
        solicitar_nome: form.solicitar_nome,
        solicitar_cpf: form.solicitar_cpf,
        solicitar_telefone: form.solicitar_telefone,
        permitir_atraso_entrada: form.permitir_atraso_entrada,
        tempo_maximo_atraso_minutos: form.tempo_maximo_atraso_minutos,
        exibir_popup_atraso: form.exibir_popup_atraso,
        tempo_popup_atraso_minutos: form.tempo_popup_atraso_minutos,
      };
      if (id) {
        const { error } = await supabase.from("simulados").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("simulados").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(id ? "Simulado atualizado" : "Simulado criado");
      qc.invalidateQueries({ queryKey: ["simulados"] });
      qc.invalidateQueries({ queryKey: ["simulado", id] });
      if (!id) navigate({ to: "/admin/simulados" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    if (!form.titulo.trim()) return toast.error("Título obrigatório");
    if (form.duracao_minutos <= 0) return toast.error("Duração deve ser maior que zero");
    if (form.data_inicio && form.data_fim && new Date(form.data_fim) <= new Date(form.data_inicio)) {
      return toast.error("A data de fim deve ser posterior à de início");
    }
    save.mutate();
  }

  return { form, setForm, duracaoLabel, submit, isPending: save.isPending };
}

export function SimuladoBasicSection({
  form, setForm, duracaoLabel,
}: {
  form: SimuladoFormData;
  setForm: React.Dispatch<React.SetStateAction<SimuladoFormData>>;
  duracaoLabel: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="border-secondary/20">
        <CardHeader><CardTitle className="text-primary text-lg">Informações básicas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instrucoes">Instruções para o estudante</Label>
            <Textarea id="instrucoes" rows={4} value={form.instrucoes} onChange={(e) => setForm({ ...form, instrucoes: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-secondary/20">
        <CardHeader><CardTitle className="text-primary text-lg">Tempo e janela de aplicação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ini">Data/hora de início</Label>
              <Input id="ini" type="datetime-local" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fim">Data/hora de fim</Label>
              <Input id="fim" type="datetime-local" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="duracao">Duração</Label>
            <Input id="duracao" readOnly tabIndex={-1} value={duracaoLabel} className="bg-muted/40 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">
              Calculada automaticamente a partir do início e fim (horário de Brasília).
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Estudantes só conseguem iniciar dentro desta janela. Deixe em branco para abertura manual.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function SimuladoRulesSection({
  form, setForm,
}: {
  form: SimuladoFormData;
  setForm: React.Dispatch<React.SetStateAction<SimuladoFormData>>;
}) {
  return (
    <Card className="border-secondary/20">
      <CardHeader><CardTitle className="text-primary text-lg">Regras de aplicação</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <SwitchRow
          label="Embaralhar questões"
          hint="Cada estudante recebe a sequência em ordem diferente."
          checked={form.embaralhar_questoes}
          onChange={(v) => setForm({ ...form, embaralhar_questoes: v })}
        />
        <SwitchRow
          label="Embaralhar alternativas"
          checked={form.embaralhar_alternativas}
          onChange={(v) => setForm({ ...form, embaralhar_alternativas: v })}
        />
        <SwitchRow
          label="Permitir revisão antes de enviar"
          checked={form.permitir_revisao}
          onChange={(v) => setForm({ ...form, permitir_revisao: v })}
        />
        <SwitchRow
          label="Mostrar resultado ao estudante"
          hint="Exibe acertos, pontuação e aproveitamento ao finalizar."
          checked={form.mostrar_resultado}
          onChange={(v) =>
            setForm({
              ...form,
              mostrar_resultado: v,
              // Gabarito comentado depende de mostrar_resultado
              mostrar_gabarito: v ? form.mostrar_gabarito : false,
            })
          }
        />
        <SwitchRow
          label="Mostrar Explicação / Gabarito comentado"
          hint={
            form.mostrar_resultado
              ? "Ao finalizar, o estudante vê a alternativa correta e a explicação de cada questão (em Markdown)."
              : "Disponível apenas quando 'Mostrar resultado ao estudante' estiver ativo."
          }
          checked={form.mostrar_gabarito && form.mostrar_resultado}
          disabled={!form.mostrar_resultado}
          onChange={(v) => setForm({ ...form, mostrar_gabarito: v })}
        />
        <SwitchRow
          label="Permitir nova tentativa"
          hint="Se ativo, o mesmo estudante pode iniciar uma nova sessão após finalizar."
          checked={form.permitir_retentativa}
          onChange={(v) => setForm({ ...form, permitir_retentativa: v })}
        />
        <SwitchRow
          label="Mostrar feedbacks"
          hint="Permite que o estudante envie e veja feedbacks em cada questão (erro, gabarito incorreto, enunciado confuso etc.)."
          checked={form.mostrar_feedbacks}
          onChange={(v) => setForm({ ...form, mostrar_feedbacks: v })}
        />

        <div className="pt-4 mt-2 border-t border-border space-y-4">
          <div>
            <p className="text-sm font-semibold text-primary">Identificação do estudante</p>
            <p className="text-xs text-muted-foreground">
              O e-mail é sempre obrigatório. Os demais campos podem ser ativados conforme a necessidade.
            </p>
          </div>
          <SwitchRow
            label="Solicitar nome completo"
            checked={form.solicitar_nome}
            onChange={(v) => setForm({ ...form, solicitar_nome: v })}
          />
          <SwitchRow
            label="Solicitar CPF"
            checked={form.solicitar_cpf}
            onChange={(v) => setForm({ ...form, solicitar_cpf: v })}
          />
          <SwitchRow
            label="Solicitar telefone"
            checked={form.solicitar_telefone}
            onChange={(v) => setForm({ ...form, solicitar_telefone: v })}
          />
        </div>

        <div className="pt-4 mt-2 border-t border-border space-y-4">
          <div>
            <p className="text-sm font-semibold text-primary">Entrada com atraso</p>
            <p className="text-xs text-muted-foreground">
              Controle se estudantes podem iniciar o simulado após o horário oficial de início (baseado no horário do servidor).
            </p>
          </div>
          <SwitchRow
            label="Permitir entrada com atraso"
            hint="Define se estudantes podem iniciar o simulado após o horário oficial de início."
            checked={form.permitir_atraso_entrada}
            onChange={(v) => setForm({ ...form, permitir_atraso_entrada: v })}
          />
          <div className={cn("flex items-center justify-between gap-4", !form.permitir_atraso_entrada && "opacity-60")}>
            <div>
              <Label>Tempo máximo de atraso</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Após esse prazo, novos acessos serão bloqueados.
              </p>
            </div>
            <Select
              value={String(form.tempo_maximo_atraso_minutos)}
              onValueChange={(v) => setForm({ ...form, tempo_maximo_atraso_minutos: Number(v) })}
              disabled={!form.permitir_atraso_entrada}
            >
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                  <SelectItem key={m} value={String(m)}>{m} minutos</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-4 mt-2 border-t border-border space-y-4">
          <div>
            <p className="text-sm font-semibold text-primary">Aviso de atraso</p>
            <p className="text-xs text-muted-foreground">
              Exibe um pop-up ao estudante que entra com atraso, informando o tempo decorrido.
            </p>
          </div>
          <SwitchRow
            label="Exibir pop-up de atraso"
            checked={form.exibir_popup_atraso}
            onChange={(v) => setForm({ ...form, exibir_popup_atraso: v })}
          />
          <div className={cn("flex items-center justify-between gap-4", !form.exibir_popup_atraso && "opacity-60")}>
            <div>
              <Label>Exibir pop-up após</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                A partir desse atraso, o aviso é exibido ao iniciar a prova.
              </p>
            </div>
            <Select
              value={String(form.tempo_popup_atraso_minutos)}
              onValueChange={(v) => setForm({ ...form, tempo_popup_atraso_minutos: Number(v) })}
              disabled={!form.exibir_popup_atraso}
            >
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 5, 10, 15, 20, 30].map((m) => (
                  <SelectItem key={m} value={String(m)}>{m} {m === 1 ? "minuto" : "minutos"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Formulário standalone (usado em "novo simulado")
export function SimuladoForm({ id, initial }: { id?: string; initial?: Partial<SimuladoFormData> }) {
  const { form, setForm, duracaoLabel, submit, isPending } = useSimuladoFormState(id, initial);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link to="/admin/simulados" className="inline-flex items-center text-sm text-secondary hover:underline mb-4">
        <ArrowLeft size={14} className="mr-1" /> Voltar
      </Link>

      <h1 className="text-3xl font-bold text-primary mb-6">
        {id ? "Editar simulado" : "Novo simulado"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <SimuladoBasicSection form={form} setForm={setForm} duracaoLabel={duracaoLabel} />
        <SimuladoRulesSection form={form} setForm={setForm} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" asChild>
            <Link to="/admin/simulados">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90">
            <Save size={16} className="mr-2" />
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SwitchRow({
  label, hint, checked, onChange, disabled,
}: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4", disabled && "opacity-60")}>
      <div>
        <Label className="cursor-pointer">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
