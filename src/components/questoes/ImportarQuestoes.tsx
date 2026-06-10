import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/ui/markdown";

const LETRAS = ["A", "B", "C", "D", "E"] as const;
type Letra = (typeof LETRAS)[number];

const LinhaSchema = z.object({
  codigo_externo: z.string().trim().max(80).optional(),
  enunciado: z.string().trim().min(10, "enunciado muito curto").max(5000),
  altA: z.string().trim().min(1, "Alternativa A obrigatória").max(2000),
  altB: z.string().trim().min(1, "Alternativa B obrigatória").max(2000),
  altC: z.string().trim().min(1, "Alternativa C obrigatória").max(2000),
  altD: z.string().trim().min(1, "Alternativa D obrigatória").max(2000),
  altE: z.string().trim().min(1, "Alternativa E obrigatória").max(2000),
  correta: z.enum(LETRAS, { message: "Alternativa correta deve ser A-E" }),
  area: z.string().trim().min(2, "area obrigatória").max(150),
  disciplina: z.string().trim().min(2, "disciplina obrigatória").max(150),
  assunto: z.string().trim().min(2, "assunto obrigatório").max(200),
  topico: z.string().trim().max(200).optional(),
  dificuldade: z.number().int().min(1).max(5).optional(),
  explicacao: z.string().trim().max(8000).optional(),
  fonte: z.string().trim().max(200).optional(),
});

type Linha = z.infer<typeof LinhaSchema>;
type ErroLinha = { linha: number; motivo: string };
type PreviewLinha = { linha: number; data: Linha };
type Resultado = { total: number; inseridas: number; erros: ErroLinha[]; previews: PreviewLinha[] };

function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function extrairLetra(s: string): Letra | null {
  const m = s.trim().match(/^([A-Ea-e])\b/);
  return m ? (m[1].toUpperCase() as Letra) : null;
}

function mapNivel(s: string): number | undefined {
  const limpo = s.toLowerCase().replace(/[.\s]/g, "");
  if (!limpo) return undefined;
  if (/^\d$/.test(limpo)) {
    const n = parseInt(limpo, 10);
    return n >= 1 && n <= 5 ? n : undefined;
  }
  if (limpo.startsWith("faci") || limpo === "facil") return 2;
  if (limpo.startsWith("medi")) return 3;
  if (limpo.startsWith("dific")) return 4;
  return undefined;
}

function montarExplicacao(row: Record<string, unknown>): string {
  const partes: string[] = [];
  for (const L of LETRAS) {
    const com = pick(row, `Comentário ${L}`, `Comentario ${L}`);
    const lei = pick(row, `Lei ${L}`);
    if (com || lei) {
      const linha = `(${L}) ${com}${com && lei ? " — " : ""}${lei ? `Fundamento: ${lei}` : ""}`.trim();
      partes.push(linha);
    }
  }
  return partes.join("\n\n");
}

function mapearLinha(row: Record<string, unknown>): { ok: true; data: Linha } | { ok: false; motivo: string } {
  const rawCorreta = pick(row, "Alternativa Correta", "Correta", "Gabarito");
  const correta = extrairLetra(rawCorreta);
  const dif = mapNivel(pick(row, "Nível", "Nivel", "Dificuldade"));

  const candidato = {
    codigo_externo: pick(row, "Código", "Codigo", "Código Externo", "Codigo Externo", "codigo_externo") || undefined,
    enunciado: pick(row, "Enunciado", "Pergunta", "Questão", "Questao"),
    altA: pick(row, "Alternativa A", "A"),
    altB: pick(row, "Alternativa B", "B"),
    altC: pick(row, "Alternativa C", "C"),
    altD: pick(row, "Alternativa D", "D"),
    altE: pick(row, "Alternativa E", "E"),
    correta: correta ?? undefined,
    area: pick(row, "Área", "Area", "Grupo", "Categoria") || undefined,
    disciplina: pick(row, "Disciplina", "Matéria", "Materia") || undefined,
    assunto: pick(row, "Assunto", "Assunto Principal") || undefined,
    topico: pick(row, "Tópico", "Topico") || undefined,
    dificuldade: dif,
    explicacao: montarExplicacao(row) || undefined,
    fonte: pick(row, "Fonte", "Origem") || undefined,
  };

  const parse = LinhaSchema.safeParse(candidato);
  if (!parse.success) {
    return {
      ok: false,
      motivo: parse.error.issues
        .map((i) => `${i.path.join(".") || "campo"}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true, data: parse.data };
}

export function ImportarQuestoes({ onConcluido }: { onConcluido?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function baixarErros(erros: ErroLinha[]) {
    const csv =
      "linha,motivo\n" +
      erros.map((e) => `${e.linha},"${e.motivo.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "erros-importacao-questoes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function processarArquivo(file: File) {
    setProcessando(true);
    setResultado(null);
    let jobId: string | null = null;

    try {
      const { data: job, error: jobErr } = await supabase
        .from("import_jobs")
        .insert({ tipo: "questoes", arquivo_nome: file.name, status: "processando" })
        .select("id")
        .single();
      if (jobErr) throw jobErr;
      jobId = job.id;

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      if (rows.length === 0) throw new Error("Planilha vazia ou sem cabeçalho.");
      if (rows.length > 2000)
        throw new Error("Limite de 2.000 questões por importação. Divida o arquivo.");

      const erros: ErroLinha[] = [];
      const validas: { linha: number; data: Linha }[] = [];

      rows.forEach((row, idx) => {
        const linhaNum = idx + 2;
        const r = mapearLinha(row);
        if (!r.ok) erros.push({ linha: linhaNum, motivo: r.motivo });
        else validas.push({ linha: linhaNum, data: r.data });
      });

      let inseridas = 0;
      for (const { linha, data } of validas) {
        const payload = {
          codigo_externo: data.codigo_externo ?? null,
          enunciado: data.enunciado,
          area: data.area!,
          disciplina: data.disciplina!,
          assunto: data.assunto!,
          topico: data.topico ?? null,
          dificuldade: data.dificuldade ?? null,
          explicacao: data.explicacao ?? null,
          fonte: data.fonte ?? null,
          ativa: true,
          status: "ativa" as const,
        };

        let questaoId: string | null = null;
        if (data.codigo_externo) {
          const { data: q, error: qErr } = await supabase
            .from("questoes")
            .upsert(payload, { onConflict: "codigo_externo" })
            .select("id")
            .single();
          if (qErr) { erros.push({ linha, motivo: `falha ao inserir/atualizar questão: ${qErr.message}` }); continue; }
          questaoId = q.id;
          await supabase.from("alternativas").delete().eq("questao_id", questaoId);
        } else {
          const { data: q, error: qErr } = await supabase
            .from("questoes")
            .insert(payload)
            .select("id")
            .single();
          if (qErr) { erros.push({ linha, motivo: `falha ao inserir questão: ${qErr.message}` }); continue; }
          questaoId = q.id;
        }

        const alts = LETRAS.map((L) => ({
          questao_id: questaoId!,
          letra: L,
          texto: data[`alt${L}` as `alt${Letra}`],
          correta: L === data.correta,
        }));
        const { error: aErr } = await supabase.from("alternativas").insert(alts);
        if (aErr) {
          if (!data.codigo_externo) await supabase.from("questoes").delete().eq("id", questaoId);
          erros.push({ linha, motivo: `falha ao inserir alternativas: ${aErr.message}` });
          continue;
        }
        inseridas++;
      }

      const res: Resultado = {
        total: rows.length,
        inseridas,
        erros,
        previews: validas.slice(0, 8),
      };
      setResultado(res);

      if (jobId) {
        await supabase
          .from("import_jobs")
          .update({
            status: "concluido",
            total_linhas: rows.length,
            linhas_ok: inseridas,
            linhas_erro: erros.length,
            erros: JSON.parse(JSON.stringify(erros.slice(0, 1000))),
          })
          .eq("id", jobId);
      }

      toast.success(`Importação finalizada: ${inseridas} de ${rows.length} questões.`);
      onConcluido?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast.error(msg);
      if (jobId) {
        await supabase.from("import_jobs").update({ status: "falhou" }).eq("id", jobId);
      }
    } finally {
      setProcessando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet size={20} /> Importar questões (Excel/CSV)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-dashed border-secondary/40 p-6 text-center">
          <Upload className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-1">
            Colunas reconhecidas: <code>Código</code> (idempotência), <code>Enunciado</code>,{" "}
            <code>Alternativa A–E</code>, <code>Alternativa Correta</code> (A-E),{" "}
            <code>Área</code>*, <code>Disciplina</code>*, <code>Assunto</code>*,{" "}
            <code>Tópico</code>, <code>Nível</code>, <code>Comentário/Lei A–E</code>.
            <span className="block mt-1 text-xs">* obrigatórias. Linhas com mesmo <code>Código</code> atualizam a questão existente.</span>
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Cada linha vira 1 questão + 5 alternativas. Máx. 2.000 linhas por arquivo.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processarArquivo(f);
            }}
          />
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={processando}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {processando ? "Processando..." : "Selecionar planilha"}
          </Button>
        </div>

        {resultado && (
          <div className="rounded-md border border-secondary/20 p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Total: {resultado.total}</Badge>
              <Badge className="bg-accent text-accent-foreground">
                <CheckCircle2 size={12} className="mr-1" /> Inseridas: {resultado.inseridas}
              </Badge>
              {resultado.erros.length > 0 && (
                <Badge variant="destructive">
                  <AlertTriangle size={12} className="mr-1" /> Erros: {resultado.erros.length}
                </Badge>
              )}
            </div>
            {resultado.erros.length > 0 && (
              <>
                <div className="max-h-64 overflow-y-auto rounded border border-destructive/30">
                  <table className="w-full text-xs">
                    <thead className="bg-destructive/10 text-destructive sticky top-0">
                      <tr>
                        <th className="text-left p-2 w-16">Linha</th>
                        <th className="text-left p-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.erros.slice(0, 100).map((e, i) => (
                        <tr key={i} className="border-t border-destructive/10">
                          <td className="p-2 font-mono">{e.linha}</td>
                          <td className="p-2 text-destructive/90">{e.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {resultado.erros.length > 100 && (
                  <p className="text-xs text-muted-foreground">
                    Mostrando 100 de {resultado.erros.length}. Baixe o relatório completo abaixo.
                  </p>
                )}
                <Button variant="outline" size="sm" onClick={() => baixarErros(resultado.erros)}>
                  <Download size={14} className="mr-1" /> Baixar relatório de erros
                </Button>
              </>
            )}

            {resultado.previews.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Eye size={14} /> Prévia das questões importadas (Markdown renderizado)
                </div>
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {resultado.previews.map((p) => (
                    <div
                      key={p.linha}
                      className="rounded-md border border-secondary/30 p-3 bg-card"
                    >
                      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                        <Badge variant="outline">Linha {p.linha}</Badge>
                        {p.data.disciplina && <Badge variant="secondary">{p.data.disciplina}</Badge>}
                        {p.data.topico && <Badge variant="secondary">{p.data.topico}</Badge>}
                      </div>
                      <Markdown>{p.data.enunciado}</Markdown>
                      <ul className="mt-2 space-y-1">
                        {LETRAS.map((L) => {
                          const correta = L === p.data.correta;
                          return (
                            <li
                              key={L}
                              className={
                                "flex gap-2 text-sm rounded px-2 py-1 " +
                                (correta ? "bg-accent/10 border border-accent/30" : "")
                              }
                            >
                              <span className="font-semibold w-5 shrink-0">{L})</span>
                              <div className="flex-1">
                                <Markdown inline>{p.data[`alt${L}` as `alt${Letra}`]}</Markdown>
                              </div>
                              {correta && (
                                <CheckCircle2 size={14} className="text-accent shrink-0 mt-0.5" />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {p.data.explicacao && (
                        <details className="mt-2 text-sm">
                          <summary className="cursor-pointer text-muted-foreground">
                            Ver explicação / fundamento
                          </summary>
                          <div className="mt-1 pl-2 border-l-2 border-secondary/30">
                            <Markdown>{p.data.explicacao}</Markdown>
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Mostrando até 8 questões como prévia. Acesse a lista de questões para ver todas.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
