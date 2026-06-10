import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { usePastas } from "@/components/pastas/PastasSidebar";
import { MarkdownEditor } from "@/components/ui/markdown-editor";

const LETRAS = ["A", "B", "C", "D", "E"] as const;
const STATUS_OPTIONS = ["ativa", "em_revisao", "arquivada"] as const;
type StatusQuestao = (typeof STATUS_OPTIONS)[number];

export type Alternativa = { letra: string; texto: string };

export type QuestaoFormData = {
  enunciado: string;
  disciplina: string;
  area: string;
  topico: string;
  assunto: string;
  codigo_externo: string;
  status: StatusQuestao;
  dificuldade: number;
  fonte: string;
  explicacao: string;
  ativa: boolean;
  pasta_id: string | null;
  alternativas: Alternativa[];
  corretaLetra: string;
};

const EMPTY: QuestaoFormData = {
  enunciado: "",
  disciplina: "",
  area: "",
  topico: "",
  assunto: "",
  codigo_externo: "",
  status: "ativa",
  dificuldade: 3,
  fonte: "",
  explicacao: "",
  ativa: true,
  pasta_id: null,
  alternativas: [
    { letra: "A", texto: "" },
    { letra: "B", texto: "" },
    { letra: "C", texto: "" },
    { letra: "D", texto: "" },
  ],
  corretaLetra: "A",
};

const schema = z.object({
  enunciado: z.string().trim().min(10, "Enunciado precisa ter ao menos 10 caracteres").max(5000),
  area: z.string().trim().min(2, "Área é obrigatória").max(120),
  disciplina: z.string().trim().min(2, "Disciplina é obrigatória").max(120),
  assunto: z.string().trim().min(2, "Assunto é obrigatório").max(160),
  topico: z.string().trim().max(120).optional().or(z.literal("")),
  codigo_externo: z.string().trim().max(80).optional().or(z.literal("")),
  status: z.enum(STATUS_OPTIONS),
  dificuldade: z.number().min(1).max(5),
});

type FieldKey = "enunciado" | "area" | "disciplina" | "assunto" | "topico" | "codigo_externo" | "status" | "dificuldade";
type FieldErrors = Partial<Record<FieldKey, string>>;

export function QuestaoForm({ id, initial }: { id?: string; initial?: Partial<QuestaoFormData> }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<QuestaoFormData>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<FieldErrors>({});
  const { data: pastas = [] } = usePastas();

  function set<K extends keyof QuestaoFormData>(k: K, v: QuestaoFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setAlt(i: number, texto: string) {
    setForm((f) => {
      const next = [...f.alternativas];
      next[i] = { ...next[i], texto };
      return { ...f, alternativas: next };
    });
  }

  function addAlt() {
    if (form.alternativas.length >= 5) return;
    const letra = LETRAS[form.alternativas.length];
    setForm((f) => ({ ...f, alternativas: [...f.alternativas, { letra, texto: "" }] }));
  }

  function removeAlt(i: number) {
    if (form.alternativas.length <= 2) return;
    setForm((f) => {
      const filtered = f.alternativas.filter((_, idx) => idx !== i);
      const relettered = filtered.map((a, idx) => ({ ...a, letra: LETRAS[idx] }));
      const correta = relettered.some((a) => a.letra === f.corretaLetra)
        ? f.corretaLetra
        : relettered[0].letra;
      return { ...f, alternativas: relettered, corretaLetra: correta };
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        const fe: FieldErrors = {};
        for (const issue of parsed.error.issues) {
          const k = issue.path[0] as FieldKey | undefined;
          if (k && !fe[k]) fe[k] = issue.message;
        }
        setErrors(fe);
        throw new Error(parsed.error.issues[0].message);
      }
      setErrors({});

      const altsValidas = form.alternativas.filter((a) => a.texto.trim().length > 0);
      if (altsValidas.length < 2) throw new Error("Adicione pelo menos 2 alternativas com texto.");
      if (!altsValidas.some((a) => a.letra === form.corretaLetra))
        throw new Error("Selecione a alternativa correta entre as preenchidas.");

      const payload = {
        enunciado: form.enunciado.trim(),
        area: form.area.trim(),
        disciplina: form.disciplina.trim(),
        assunto: form.assunto.trim(),
        topico: form.topico.trim() || null,
        codigo_externo: form.codigo_externo.trim() || null,
        status: form.status,
        dificuldade: form.dificuldade,
        fonte: form.fonte.trim() || null,
        explicacao: form.explicacao.trim() || null,
        ativa: form.ativa,
        pasta_id: form.pasta_id,
      };

      let questaoId = id;
      if (id) {
        const { error } = await supabase.from("questoes").update(payload).eq("id", id);
        if (error) throw error;
        await supabase.from("alternativas").delete().eq("questao_id", id);
      } else {
        const { data, error } = await supabase.from("questoes").insert(payload).select("id").single();
        if (error) throw error;
        questaoId = data.id;
      }

      const rows = altsValidas.map((a) => ({
        questao_id: questaoId!,
        letra: a.letra,
        texto: a.texto.trim(),
        correta: a.letra === form.corretaLetra,
      }));
      const { error: e2 } = await supabase.from("alternativas").insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success(id ? "Questão atualizada" : "Questão criada");
      qc.invalidateQueries({ queryKey: ["questoes"] });
      qc.invalidateQueries({ queryKey: ["banco-questoes"] });
      navigate({ to: "/admin/banco-questoes" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link to="/admin/banco-questoes" className="inline-flex items-center gap-1 text-sm text-secondary hover:underline mb-4">
        <ArrowLeft size={14} /> Voltar para Questões
      </Link>

      <h1 className="text-3xl font-bold text-primary mb-6">
        {id ? "Editar questão" : "Nova questão"}
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader><CardTitle>Enunciado</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="enunciado">Texto do enunciado *</Label>
              <MarkdownEditor
                id="enunciado"
                rows={8}
                value={form.enunciado}
                onChange={(v) => set("enunciado", v)}
                placeholder="Digite o enunciado da questão... Você pode usar Markdown."
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Classificação</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="area">Área *</Label>
              <Input
                id="area"
                value={form.area}
                onChange={(e) => set("area", e.target.value)}
                placeholder="Ex.: Direito Penal"
                aria-invalid={!!errors.area}
                required
              />
              {errors.area && <p className="text-xs text-destructive">{errors.area}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="disciplina">Disciplina *</Label>
              <Input
                id="disciplina"
                value={form.disciplina}
                onChange={(e) => set("disciplina", e.target.value)}
                placeholder="Ex.: Crimes contra a pessoa"
                aria-invalid={!!errors.disciplina}
                required
              />
              {errors.disciplina && <p className="text-xs text-destructive">{errors.disciplina}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assunto">Assunto *</Label>
              <Input
                id="assunto"
                value={form.assunto}
                onChange={(e) => set("assunto", e.target.value)}
                placeholder="Ex.: Homicídio doloso"
                aria-invalid={!!errors.assunto}
                required
              />
              {errors.assunto && <p className="text-xs text-destructive">{errors.assunto}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="topico">Tópico (opcional)</Label>
              <Input
                id="topico"
                value={form.topico}
                onChange={(e) => set("topico", e.target.value)}
                placeholder="Subdivisão interna"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dificuldade">Dificuldade (1-5)</Label>
              <Input
                id="dificuldade"
                type="number"
                min={1}
                max={5}
                value={form.dificuldade}
                onChange={(e) => set("dificuldade", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as StatusQuestao)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="em_revisao">Em revisão</SelectItem>
                  <SelectItem value="arquivada">Arquivada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigo_externo">Código externo</Label>
              <Input
                id="codigo_externo"
                value={form.codigo_externo}
                onChange={(e) => set("codigo_externo", e.target.value)}
                placeholder="Identificador único (CSV)"
              />
              <p className="text-xs text-muted-foreground">Usado para evitar duplicação em importações.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="fonte">Fonte</Label>
              <Input
                id="fonte"
                value={form.fonte}
                onChange={(e) => set("fonte", e.target.value)}
                placeholder="Ex.: ENEM 2023"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="pasta">Pasta</Label>
              <Select
                value={form.pasta_id ?? "__sem__"}
                onValueChange={(v) => set("pasta_id", v === "__sem__" ? null : v)}
              >
                <SelectTrigger id="pasta">
                  <SelectValue placeholder="Sem pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__sem__">Sem pasta</SelectItem>
                  {pastas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Alternativas</CardTitle>
              {form.alternativas.length < 5 && (
                <Button type="button" size="sm" variant="outline" onClick={addAlt}>
                  <Plus size={14} className="mr-1" /> Adicionar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={form.corretaLetra}
              onValueChange={(v) => set("corretaLetra", v)}
              className="space-y-3"
            >
              {form.alternativas.map((a, i) => (
                <div key={a.letra} className="flex items-start gap-3">
                  <div className="flex items-center gap-2 pt-2">
                    <RadioGroupItem value={a.letra} id={`alt-${a.letra}`} />
                    <Label htmlFor={`alt-${a.letra}`} className="font-bold text-primary w-6">
                      {a.letra}
                    </Label>
                  </div>
                  <div className="flex-1">
                    <MarkdownEditor
                      rows={2}
                      value={a.texto}
                      onChange={(v) => setAlt(i, v)}
                      placeholder={`Texto da alternativa ${a.letra}`}
                    />
                  </div>
                  {form.alternativas.length > 2 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeAlt(i)}
                      className="text-destructive"
                    >
                      <X size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground mt-3">
              Selecione o círculo da alternativa correta.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Explicação / Gabarito comentado</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <MarkdownEditor
              rows={5}
              value={form.explicacao}
              onChange={(v) => set("explicacao", v)}
              placeholder="Justificativa da resposta correta (opcional). Suporta Markdown."
            />
            <div className="flex items-center justify-between">
              <div>
                <Label>Questão ativa</Label>
                <p className="text-xs text-muted-foreground">Inativa não pode ser usada em novos simulados.</p>
              </div>
              <Switch checked={form.ativa} onCheckedChange={(v) => set("ativa", v)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/banco-questoes">Cancelar</Link>
          </Button>
          <Button
            type="submit"
            disabled={save.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Save size={16} className="mr-2" />
            {save.isPending ? "Salvando..." : "Salvar questão"}
          </Button>
        </div>
      </form>
    </div>
  );
}
