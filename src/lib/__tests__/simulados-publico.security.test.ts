/**
 * Regression tests — student-facing payloads MUST NEVER leak:
 *   - `correta` (gabarito) em alternativas ou respostas
 *   - `explicacao` (justificativa oficial) nas questões
 *   - `mostrar_gabarito: true` no objeto simulado
 *
 * Estes testes blindam a camada de sanitização usada pelo server function
 * público `getProvaPorSessao`. Mesmo que o banco (ou um chamador malicioso
 * via DevTools / chamada direta à API) devolva TODOS os campos sensíveis,
 * a saída ao estudante deve permanecer limpa.
 */
import { describe, it, expect } from "vitest";
import {
  sanitizeAlternativas,
  sanitizeQuestao,
  sanitizeVinculos,
  sanitizeRespostas,
  sanitizeSimuladoForStudent,
} from "../simulados-publico.sanitize";

// Payload simulando dados crus do banco, propositalmente contaminados
// com TODOS os campos sensíveis.
const RAW_ALTERNATIVAS = [
  { id: "a-1", letra: "A", texto: "3", correta: false, peso: 0 },
  { id: "a-2", letra: "B", texto: "4", correta: true, peso: 1 },
  { id: "a-3", letra: "C", texto: "5", correta: false, segredo: "x" },
];

const RAW_QUESTAO = {
  id: "q-1",
  enunciado: "2+2?",
  disciplina: "Mat",
  topico: "Soma",
  dificuldade: "facil",
  explicacao: "Resposta oficial: 4. Justificativa do gabarito.",
  alternativas: RAW_ALTERNATIVAS,
  gabarito_oficial: "B",
};

const RAW_VINCULOS = [
  { ordem: 1, peso: 2, questoes: RAW_QUESTAO, extra_admin: "secret" },
];

const RAW_RESPOSTAS = [
  {
    questao_id: "q-1",
    alternativa_id: "a-1",
    correta: false,
    tempo_gasto_segundos: 12,
    marcada_em: "2026-01-01T00:00:00Z",
  },
];

const RAW_SIMULADO = {
  id: "sim-1",
  titulo: "Simulado X",
  descricao: "desc",
  instrucoes: "inst",
  duracao_minutos: 60,
  data_inicio: null,
  data_fim: null,
  embaralhar_questoes: false,
  embaralhar_alternativas: true,
  permitir_revisao: true,
  mostrar_gabarito: true, // admin habilitou; estudante NÃO pode receber true
  mostrar_resultado: true,
  permitir_retentativa: false,
  mostrar_feedbacks: true,
  token_acesso: "DEADBEEF",
  gabarito_pdf_url: "https://internal/gabarito.pdf",
};

function deepKeys(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => deepKeys(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      deepKeys(v, out);
    }
  }
  return out;
}

describe("simulados-publico.sanitize — regressão de vazamento de gabarito", () => {
  describe("sanitizeAlternativas", () => {
    it("remove `correta` e qualquer campo fora da whitelist", () => {
      const out = sanitizeAlternativas(RAW_ALTERNATIVAS);
      expect(out).toHaveLength(3);
      for (const a of out) {
        expect(Object.keys(a).sort()).toEqual(["id", "letra", "texto"]);
        expect(a).not.toHaveProperty("correta");
      }
    });

    it("aceita lista nula/indefinida sem quebrar", () => {
      expect(sanitizeAlternativas(null)).toEqual([]);
      expect(sanitizeAlternativas(undefined)).toEqual([]);
    });
  });

  describe("sanitizeQuestao", () => {
    it("zera `explicacao` e sanitiza alternativas recursivamente", () => {
      const out = sanitizeQuestao(RAW_QUESTAO);
      expect(out).not.toBeNull();
      expect(out!.explicacao).toBeNull();
      const keys = deepKeys(out);
      expect(keys.has("correta")).toBe(false);
      expect(keys.has("gabarito_oficial")).toBe(false);
    });

    it("retorna null para questão ausente", () => {
      expect(sanitizeQuestao(null)).toBeNull();
      expect(sanitizeQuestao(undefined)).toBeNull();
    });
  });

  describe("sanitizeVinculos", () => {
    it("não propaga `correta`, `explicacao` ou campos administrativos", () => {
      const out = sanitizeVinculos(RAW_VINCULOS);
      const keys = deepKeys(out);
      expect(keys.has("correta")).toBe(false);
      expect(keys.has("extra_admin")).toBe(false);
      // explicacao existe (igual a null) mas nunca com conteúdo
      const explicacoes: unknown[] = [];
      const walk = (v: unknown) => {
        if (v && typeof v === "object") {
          if (!Array.isArray(v)) {
            for (const [k, vv] of Object.entries(v)) {
              if (k === "explicacao") explicacoes.push(vv);
              walk(vv);
            }
          } else v.forEach(walk);
        }
      };
      walk(out);
      expect(explicacoes.length).toBeGreaterThan(0);
      for (const e of explicacoes) expect(e).toBeNull();
    });
  });

  describe("sanitizeRespostas", () => {
    it("remove `correta` e outros campos internos", () => {
      const out = sanitizeRespostas(RAW_RESPOSTAS);
      expect(out).toHaveLength(1);
      expect(Object.keys(out[0]).sort()).toEqual([
        "alternativa_id",
        "questao_id",
      ]);
      expect(out[0]).not.toHaveProperty("correta");
      expect(out[0]).not.toHaveProperty("tempo_gasto_segundos");
    });

    it("preserva alternativa_id null (não respondida)", () => {
      const out = sanitizeRespostas([
        { questao_id: "q-1", alternativa_id: null, correta: null },
      ]);
      expect(out[0].alternativa_id).toBeNull();
      expect(out[0]).not.toHaveProperty("correta");
    });
  });

  describe("sanitizeSimuladoForStudent", () => {
    it("força mostrar_gabarito = false MESMO se o banco disser true", () => {
      const out = sanitizeSimuladoForStudent(RAW_SIMULADO);
      expect(out.mostrar_gabarito).toBe(false);
    });

    it("não propaga token de acesso nem campos administrativos", () => {
      const out = sanitizeSimuladoForStudent(RAW_SIMULADO) as Record<
        string,
        unknown
      >;
      expect(out).not.toHaveProperty("token_acesso");
      expect(out).not.toHaveProperty("gabarito_pdf_url");
    });

    it("usa apenas o conjunto de campos esperado", () => {
      const out = sanitizeSimuladoForStudent(RAW_SIMULADO);
      expect(Object.keys(out).sort()).toEqual(
        [
          "data_fim",
          "data_inicio",
          "descricao",
          "duracao_minutos",
          "embaralhar_alternativas",
          "embaralhar_questoes",
          "id",
          "instrucoes",
          "mostrar_feedbacks",
          "mostrar_gabarito",
          "mostrar_resultado",
          "permitir_retentativa",
          "permitir_revisao",
          "titulo",
        ].sort(),
      );
    });
  });

  describe("Cenário integrado (defesa em profundidade)", () => {
    it("payload final entregue ao estudante não contém `correta` em lugar algum", () => {
      const payload = {
        simulado: sanitizeSimuladoForStudent(RAW_SIMULADO),
        vinculos: sanitizeVinculos(RAW_VINCULOS),
        respostas: sanitizeRespostas(RAW_RESPOSTAS),
      };
      const keys = deepKeys(payload);
      expect(keys.has("correta")).toBe(false);
      expect(keys.has("token_acesso")).toBe(false);
      expect(keys.has("gabarito_oficial")).toBe(false);
      expect(keys.has("extra_admin")).toBe(false);
      // Sanity: campos esperados ainda presentes
      expect(keys.has("alternativas")).toBe(true);
      expect(keys.has("enunciado")).toBe(true);
    });
  });
});
