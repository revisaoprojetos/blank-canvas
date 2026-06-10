import { useRef, useState } from "react";
import Papa from "papaparse";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";

// Linha esperada no CSV
const LinhaSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "e-mail obrigatório")
    .max(255)
    .email("e-mail inválido")
    .transform((v) => v.toLowerCase()),
  nome: z.string().trim().max(150).optional().or(z.literal("")),
  cpf: z
    .string()
    .trim()
    .max(14)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.replace(/\D/g, "") : ""))
    .refine((v) => v === "" || v.length === 11, "CPF deve ter 11 dígitos"),
  telefone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.replace(/\s+/g, " ") : "")),
});

type LinhaValida = z.infer<typeof LinhaSchema>;

type ErroLinha = {
  linha: number;
  email: string;
  motivo: string;
};

type Resultado = {
  total: number;
  inseridos: number;
  ignorados_duplicados: number;
  erros: ErroLinha[];
};

export function ImportarEstudantesCSV({ onConcluido }: { onConcluido?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function baixarModelo() {
    const csv = "email,nome,cpf,telefone\nfulano@exemplo.com,Fulano da Silva,12345678901,11999998888\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-estudantes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function baixarErros(erros: ErroLinha[]) {
    const csv =
      "linha,email,motivo\n" +
      erros
        .map(
          (e) =>
            `${e.linha},"${e.email.replace(/"/g, '""')}","${e.motivo.replace(/"/g, '""')}"`,
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "erros-importacao.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function processarArquivo(file: File) {
    setProcessando(true);
    setResultado(null);

    let jobId: string | null = null;
    try {
      // 1) Cria registro de job para auditoria
      const { data: job, error: jobErr } = await supabase
        .from("import_jobs")
        .insert({ tipo: "estudantes", arquivo_nome: file.name, status: "processando" })
        .select("id")
        .single();
      if (jobErr) throw jobErr;
      jobId = job.id;

      // 2) Parse CSV
      const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: "greedy",
          transformHeader: (h) => h.trim().toLowerCase(),
          complete: resolve,
          error: reject,
        });
      });

      const linhas = parsed.data;
      if (linhas.length === 0) throw new Error("Arquivo vazio ou sem cabeçalho.");
      if (linhas.length > 10000)
        throw new Error("Limite de 10.000 linhas por importação. Divida o arquivo.");

      // 3) Valida linha a linha
      const validas: LinhaValida[] = [];
      const erros: ErroLinha[] = [];
      const vistosNoArquivo = new Set<string>();

      linhas.forEach((row, idx) => {
        const linhaNum = idx + 2; // +1 header, +1 base 1
        const parse = LinhaSchema.safeParse({
          email: row.email ?? "",
          nome: row.nome ?? "",
          cpf: row.cpf ?? "",
          telefone: row.telefone ?? "",
        });
        if (!parse.success) {
          erros.push({
            linha: linhaNum,
            email: row.email ?? "",
            motivo: parse.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
          });
          return;
        }
        if (vistosNoArquivo.has(parse.data.email)) {
          erros.push({
            linha: linhaNum,
            email: parse.data.email,
            motivo: "e-mail duplicado dentro do arquivo",
          });
          return;
        }
        vistosNoArquivo.add(parse.data.email);
        validas.push(parse.data);
      });

      // 4) Verifica duplicatas já existentes no banco (em lotes)
      let jaExistentes = new Set<string>();
      for (let i = 0; i < validas.length; i += 500) {
        const fatia = validas.slice(i, i + 500).map((v) => v.email);
        if (fatia.length === 0) continue;
        const { data, error } = await supabase
          .from("estudantes")
          .select("email")
          .in("email", fatia);
        if (error) throw error;
        data?.forEach((d) => jaExistentes.add(d.email));
      }

      const paraInserir = validas.filter((v) => !jaExistentes.has(v.email));
      const ignorados_duplicados = validas.length - paraInserir.length;

      // 5) Insere em lotes
      let inseridos = 0;
      for (let i = 0; i < paraInserir.length; i += 200) {
        const fatia = paraInserir.slice(i, i + 200).map((v) => ({
          email: v.email,
          nome: v.nome || null,
          cpf: v.cpf || null,
          telefone: v.telefone || null,
        }));
        const { error, count } = await supabase
          .from("estudantes")
          .insert(fatia, { count: "exact" });
        if (error) {
          // erro de lote inteiro — registra
          fatia.forEach((f) =>
            erros.push({ linha: -1, email: f.email, motivo: `falha ao inserir: ${error.message}` }),
          );
        } else {
          inseridos += count ?? fatia.length;
        }
      }

      const res: Resultado = {
        total: linhas.length,
        inseridos,
        ignorados_duplicados,
        erros,
      };
      setResultado(res);

      // 6) Atualiza job
      if (jobId) {
        await supabase
          .from("import_jobs")
          .update({
            status: "concluido",
            total_linhas: linhas.length,
            linhas_ok: inseridos,
            linhas_erro: erros.length,
            erros: JSON.parse(JSON.stringify(erros.slice(0, 1000))),
          })
          .eq("id", jobId);
      }

      toast.success(
        `Importação finalizada: ${inseridos} inseridos, ${ignorados_duplicados} já existiam, ${erros.length} com erro.`,
      );
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet size={20} /> Importar via CSV
          </CardTitle>
          <Button variant="outline" size="sm" onClick={baixarModelo}>
            <Download size={14} className="mr-1" /> Modelo CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-dashed border-secondary/40 p-6 text-center">
          <Upload className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">
            Colunas aceitas: <code>email</code> (obrigatório), <code>nome</code>, <code>cpf</code>,{" "}
            <code>telefone</code>. Máx. 10.000 linhas.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
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
            {processando ? "Processando..." : "Selecionar arquivo"}
          </Button>
        </div>

        {resultado && (
          <div className="rounded-md border border-secondary/20 p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Total: {resultado.total}</Badge>
              <Badge className="bg-accent text-accent-foreground">
                <CheckCircle2 size={12} className="mr-1" /> Inseridos: {resultado.inseridos}
              </Badge>
              <Badge variant="outline">Duplicados ignorados: {resultado.ignorados_duplicados}</Badge>
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
                        <th className="text-left p-2">E-mail</th>
                        <th className="text-left p-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.erros.slice(0, 100).map((e, i) => (
                        <tr key={i} className="border-t border-destructive/10">
                          <td className="p-2 font-mono">{e.linha > 0 ? e.linha : "—"}</td>
                          <td className="p-2 truncate max-w-[200px]">{e.email}</td>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
