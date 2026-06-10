/**
 * Funções puras de sanitização para o endpoint público de simulado.
 *
 * Regras de segurança:
 *   - Durante a prova, estudantes NUNCA recebem `correta` (alternativas),
 *     `correta` (respostas) ou `explicacao` (questões).
 *   - `mostrar_gabarito` exposto ao estudante reflete apenas a intenção
 *     do organizador; o conteúdo do gabarito só é incluído quando o
 *     servidor decide explicitamente revelar (sessão finalizada + flag).
 */

export type AlternativaPublica = {
  id: string;
  letra: string;
  texto: string;
  correta?: boolean;
};

export type QuestaoPublica = {
  id: string;
  enunciado: string;
  disciplina?: string | null;
  topico?: string | null;
  dificuldade?: string | null;
  explicacao: string | null;
  alternativas: AlternativaPublica[];
};

export type VinculoPublico = {
  ordem: number;
  peso: number;
  questoes: QuestaoPublica | null;
};

export type RespostaPublica = {
  questao_id: string;
  alternativa_id: string | null;
};

export function sanitizeAlternativas(
  alternativas: ReadonlyArray<Record<string, unknown>> | null | undefined,
  opts: { includeCorreta?: boolean } = {},
): AlternativaPublica[] {
  return (alternativas ?? []).map((a) => {
    const base: AlternativaPublica = {
      id: String(a.id),
      letra: String(a.letra ?? ""),
      texto: String(a.texto ?? ""),
    };
    if (opts.includeCorreta) base.correta = !!a.correta;
    return base;
  });
}

export function sanitizeQuestao(
  questao: Record<string, unknown> | null | undefined,
  opts: { includeGabarito?: boolean } = {},
): QuestaoPublica | null {
  if (!questao) return null;
  return {
    id: String(questao.id),
    enunciado: String(questao.enunciado ?? ""),
    disciplina: (questao.disciplina as string | null) ?? null,
    topico: (questao.topico as string | null) ?? null,
    dificuldade: (questao.dificuldade as string | null) ?? null,
    explicacao: opts.includeGabarito
      ? ((questao.explicacao as string | null) ?? null)
      : null,
    alternativas: sanitizeAlternativas(
      (questao.alternativas as ReadonlyArray<Record<string, unknown>>) ?? [],
      { includeCorreta: !!opts.includeGabarito },
    ),
  };
}

export function sanitizeVinculos(
  vinculos: ReadonlyArray<Record<string, unknown>> | null | undefined,
  opts: { includeGabarito?: boolean } = {},
): VinculoPublico[] {
  return (vinculos ?? []).map((v) => ({
    ordem: Number(v.ordem ?? 0),
    peso: Number(v.peso ?? 1),
    questoes: sanitizeQuestao(
      (v.questoes as Record<string, unknown> | null) ?? null,
      opts,
    ),
  }));
}

export function sanitizeRespostas(
  respostas: ReadonlyArray<Record<string, unknown>> | null | undefined,
): RespostaPublica[] {
  return (respostas ?? []).map((r) => ({
    questao_id: String(r.questao_id),
    alternativa_id:
      r.alternativa_id == null ? null : String(r.alternativa_id),
  }));
}

export function sanitizeSimuladoForStudent(
  sim: Record<string, unknown>,
): {
  id: string;
  titulo: string;
  descricao: string | null;
  instrucoes: string | null;
  duracao_minutos: number;
  data_inicio: string | null;
  data_fim: string | null;
  embaralhar_questoes: boolean;
  embaralhar_alternativas: boolean;
  permitir_revisao: boolean;
  mostrar_gabarito: false;
  mostrar_resultado: boolean;
  permitir_retentativa: boolean;
  mostrar_feedbacks: boolean;
  permitir_atraso_entrada: boolean;
  tempo_maximo_atraso_minutos: number;
  exibir_popup_atraso: boolean;
  tempo_popup_atraso_minutos: number;
} {
  return {
    id: String(sim.id),
    titulo: String(sim.titulo ?? ""),
    descricao: (sim.descricao as string | null) ?? null,
    instrucoes: (sim.instrucoes as string | null) ?? null,
    duracao_minutos: Number(sim.duracao_minutos ?? 0),
    data_inicio: (sim.data_inicio as string | null) ?? null,
    data_fim: (sim.data_fim as string | null) ?? null,
    embaralhar_questoes: !!sim.embaralhar_questoes,
    embaralhar_alternativas: !!sim.embaralhar_alternativas,
    permitir_revisao: sim.permitir_revisao !== false,
    mostrar_gabarito: false,
    mostrar_resultado: sim.mostrar_resultado !== false,
    permitir_retentativa: !!sim.permitir_retentativa,
    mostrar_feedbacks: sim.mostrar_feedbacks !== false,
    permitir_atraso_entrada: sim.permitir_atraso_entrada !== false,
    tempo_maximo_atraso_minutos: Number(sim.tempo_maximo_atraso_minutos ?? 30),
    exibir_popup_atraso: sim.exibir_popup_atraso !== false,
    tempo_popup_atraso_minutos: Number(sim.tempo_popup_atraso_minutos ?? 5),
  };
}

/**
 * Variante usada SOMENTE quando a sessão foi finalizada e o organizador
 * habilitou explicitamente `mostrar_gabarito`. Mantém os mesmos campos da
 * versão pública, mas com `mostrar_gabarito: true`.
 */
export function sanitizeSimuladoComGabarito(
  sim: Record<string, unknown>,
): ReturnType<typeof sanitizeSimuladoForStudent> {
  const base = sanitizeSimuladoForStudent(sim);
  return { ...base, mostrar_gabarito: true as unknown as false };
}

/** Aplica ordem persistida em `sessoes_prova.ordem_questoes`. */
export function aplicarOrdemPersistida<T extends VinculoPublico>(
  vinculos: T[],
  ordem: {
    questoes?: string[];
    alternativas?: Record<string, string[]>;
  } | null | undefined,
): T[] {
  if (!ordem) return vinculos;
  let out = vinculos;
  if (Array.isArray(ordem.questoes) && ordem.questoes.length) {
    const pos = new Map(ordem.questoes.map((id, i) => [id, i]));
    out = [...out].sort((a, b) => {
      const ia = pos.get(a.questoes?.id ?? "") ?? 9999;
      const ib = pos.get(b.questoes?.id ?? "") ?? 9999;
      return ia - ib;
    });
  }
  if (ordem.alternativas) {
    out = out.map((v) => {
      if (!v.questoes) return v;
      const ordemAlt = ordem.alternativas?.[v.questoes.id];
      if (!ordemAlt) return v;
      const pos = new Map(ordemAlt.map((id, i) => [id, i]));
      return {
        ...v,
        questoes: {
          ...v.questoes,
          alternativas: [...v.questoes.alternativas].sort(
            (a, b) =>
              (pos.get(a.id) ?? 9999) - (pos.get(b.id) ?? 9999),
          ),
        },
      };
    });
  }
  return out;
}

/**
 * Decide se um aluno pode iniciar uma NOVA sessão neste simulado, considerando
 * as regras de "entrada com atraso". Função pura — usada pelo servidor para
 * bloquear novas sessões e testável isoladamente.
 *
 * Regras:
 *   - Se não houver `data_inicio`, nunca bloqueia por atraso.
 *   - Se `permitir_atraso_entrada === false`, qualquer entrada após
 *     `data_inicio` é bloqueada.
 *   - Caso contrário, a janela é `[data_inicio, data_inicio + tempo_maximo_atraso_minutos]`.
 *   - Esta função NUNCA deve ser chamada para sessões já ativas — quem já
 *     iniciou continua acessando normalmente, independente do prazo.
 */
export function verificarBloqueioPorAtraso(input: {
  data_inicio: string | Date | null | undefined;
  permitir_atraso_entrada?: boolean | null;
  tempo_maximo_atraso_minutos?: number | null;
  agoraMs: number;
}): { bloqueado: boolean; motivo?: "sem_atraso_permitido" | "prazo_excedido" } {
  if (!input.data_inicio) return { bloqueado: false };
  const inicioMs = new Date(input.data_inicio).getTime();
  if (!Number.isFinite(inicioMs)) return { bloqueado: false };

  if (input.permitir_atraso_entrada === false) {
    return input.agoraMs > inicioMs
      ? { bloqueado: true, motivo: "sem_atraso_permitido" }
      : { bloqueado: false };
  }

  const minutos = Number(input.tempo_maximo_atraso_minutos ?? 30);
  const limiteMs = inicioMs + minutos * 60_000;
  return input.agoraMs > limiteMs
    ? { bloqueado: true, motivo: "prazo_excedido" }
    : { bloqueado: false };
}
