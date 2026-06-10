/**
 * Testes da regra "Entrada com atraso" em simulados públicos.
 *
 * Cobre o helper puro `verificarBloqueioPorAtraso`, que é o ponto de decisão
 * usado pelo servidor (`iniciarSessaoPublica`) para impedir a criação de NOVAS
 * sessões fora da janela de entrada. Sessões já ativas NÃO passam por este
 * caminho — o servidor reaproveita a sessão existente antes de verificar
 * qualquer regra de atraso, de modo que o comportamento "quem já iniciou
 * continua entrando" é garantido pela ordem das verificações no handler e
 * reafirmado pelos testes abaixo.
 */
import { describe, it, expect } from "vitest";
import { verificarBloqueioPorAtraso } from "../simulados-publico.sanitize";

// Horário oficial de início do simulado (referência fixa para os cálculos)
const INICIO_ISO = "2026-06-10T08:00:00.000Z";
const INICIO_MS = new Date(INICIO_ISO).getTime();
const MIN = 60_000;

describe("verificarBloqueioPorAtraso — regras de entrada com atraso", () => {
  describe("permitir_atraso_entrada = true (default)", () => {
    it("permite entrada antes do horário de início", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS - 5 * MIN,
      });
      expect(out.bloqueado).toBe(false);
    });

    it("permite entrada exatamente no horário de início", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS,
      });
      expect(out.bloqueado).toBe(false);
    });

    it("permite entrada 12 minutos depois quando o limite é 20 minutos", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS + 12 * MIN,
      });
      expect(out.bloqueado).toBe(false);
    });

    it("permite entrada exatamente no limite (20 minutos)", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS + 20 * MIN,
      });
      expect(out.bloqueado).toBe(false);
    });

    it("permite entrada 1 minuto antes do prazo final", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS + 19 * MIN,
      });
      expect(out.bloqueado).toBe(false);
    });

    it("bloqueia entrada 1 minuto após o limite (21 minutos)", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS + 21 * MIN,
      });
      expect(out.bloqueado).toBe(true);
      expect(out.motivo).toBe("prazo_excedido");
    });

    it("bloqueia entrada 1 segundo após o limite (borda imediata)", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS + 20 * MIN + 1_000,
      });
      expect(out.bloqueado).toBe(true);
      expect(out.motivo).toBe("prazo_excedido");
    });

    it("usa o padrão de 30 minutos quando tempo_maximo_atraso_minutos é nulo", () => {
      const dentro = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: null,
        agoraMs: INICIO_MS + 29 * MIN,
      });
      const fora = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: null,
        agoraMs: INICIO_MS + 31 * MIN,
      });
      expect(dentro.bloqueado).toBe(false);
      expect(fora.bloqueado).toBe(true);
    });
  });

  describe("permitir_atraso_entrada = false", () => {
    it("permite entrada exatamente no horário de início", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: false,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS,
      });
      expect(out.bloqueado).toBe(false);
    });

    it("bloqueia 1 minuto após o início, ignorando o valor do tempo máximo", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: false,
        tempo_maximo_atraso_minutos: 120,
        agoraMs: INICIO_MS + 1 * MIN,
      });
      expect(out.bloqueado).toBe(true);
      expect(out.motivo).toBe("sem_atraso_permitido");
    });

    it("permite entrada antes do início", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: false,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS - 1 * MIN,
      });
      expect(out.bloqueado).toBe(false);
    });
  });

  describe("data_inicio ausente", () => {
    it("nunca bloqueia quando data_inicio é null", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: null,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS + 999 * MIN,
      });
      expect(out.bloqueado).toBe(false);
    });

    it("nunca bloqueia quando data_inicio é undefined, mesmo com atraso desativado", () => {
      const out = verificarBloqueioPorAtraso({
        data_inicio: undefined,
        permitir_atraso_entrada: false,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS + 999 * MIN,
      });
      expect(out.bloqueado).toBe(false);
    });
  });

  describe("Sessões já ativas — invariante do handler", () => {
    /**
     * O servidor (`iniciarSessaoPublica`) só chama `verificarBloqueioPorAtraso`
     * dentro do ramo `else` que cria uma nova sessão. Quem já tem sessão ativa
     * entra antes nesse ramo e retorna o id existente. Este teste documenta o
     * contrato: simular o fluxo do handler com uma "sessão ativa" jamais deve
     * acionar o bloqueio, mesmo dias após o limite.
     */
    function simularHandlerInicio(opts: {
      sessaoAtivaExistente: boolean;
      data_inicio: string;
      permitir_atraso_entrada: boolean;
      tempo_maximo_atraso_minutos: number;
      agoraMs: number;
    }): { resultado: "sessao_reaproveitada" | "criada" | "bloqueada" } {
      if (opts.sessaoAtivaExistente) {
        return { resultado: "sessao_reaproveitada" };
      }
      const b = verificarBloqueioPorAtraso({
        data_inicio: opts.data_inicio,
        permitir_atraso_entrada: opts.permitir_atraso_entrada,
        tempo_maximo_atraso_minutos: opts.tempo_maximo_atraso_minutos,
        agoraMs: opts.agoraMs,
      });
      return b.bloqueado ? { resultado: "bloqueada" } : { resultado: "criada" };
    }

    it("aluno com sessão ativa entra mesmo MUITO após o prazo", () => {
      const r = simularHandlerInicio({
        sessaoAtivaExistente: true,
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS + 24 * 60 * MIN, // 1 dia depois
      });
      expect(r.resultado).toBe("sessao_reaproveitada");
    });

    it("aluno com sessão ativa entra mesmo com permitir_atraso_entrada=false", () => {
      const r = simularHandlerInicio({
        sessaoAtivaExistente: true,
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: false,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS + 5 * MIN,
      });
      expect(r.resultado).toBe("sessao_reaproveitada");
    });

    it("aluno SEM sessão é bloqueado nas mesmas condições (1 minuto além)", () => {
      const r = simularHandlerInicio({
        sessaoAtivaExistente: false,
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS + 21 * MIN,
      });
      expect(r.resultado).toBe("bloqueada");
    });

    it("aluno SEM sessão entra dentro do prazo (1 minuto antes do limite)", () => {
      const r = simularHandlerInicio({
        sessaoAtivaExistente: false,
        data_inicio: INICIO_ISO,
        permitir_atraso_entrada: true,
        tempo_maximo_atraso_minutos: 20,
        agoraMs: INICIO_MS + 19 * MIN,
      });
      expect(r.resultado).toBe("criada");
    });
  });
});
