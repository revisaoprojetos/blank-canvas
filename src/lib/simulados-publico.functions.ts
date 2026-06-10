import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

const TokenSchema = z.object({
  token: z.string().min(8).max(128).regex(/^[a-f0-9]+$/i, "Token inválido"),
});

function linkValido(s: {
  status: string;
  link_revogado_em: string | null;
  link_expira_em: string | null;
}): { ok: true } | { ok: false; motivo: string } {
  if (!["agendado", "em_andamento", "encerrado"].includes(s.status)) {
    return { ok: false, motivo: "Simulado indisponível." };
  }
  if (s.link_revogado_em) return { ok: false, motivo: "Este link foi revogado pelo organizador." };
  if (s.link_expira_em && new Date(s.link_expira_em).getTime() < Date.now()) {
    return { ok: false, motivo: "Este link expirou." };
  }
  return { ok: true };
}

export const getSimuladoPublico = createServerFn({ method: "POST" })
  .inputValidator((data) => TokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: s, error } = await supabaseAdmin
      .from("simulados")
      .select("id, titulo, descricao, instrucoes, duracao_minutos, status, data_inicio, data_fim, link_expira_em, link_revogado_em, solicitar_nome, solicitar_cpf, solicitar_telefone, permitir_atraso_entrada, tempo_maximo_atraso_minutos, exibir_popup_atraso, tempo_popup_atraso_minutos")
      .eq("token_acesso", data.token)
      .maybeSingle();

    if (error) throw new Error("Falha ao carregar o simulado.");
    if (!s) return { found: false as const, motivo: "Link inválido ou não encontrado." };

    const v = linkValido(s);
    if (!v.ok) return { found: false as const, motivo: v.motivo };

    // Auditoria de acesso ao link público (não bloqueia em caso de falha)
    try {
      await supabaseAdmin.from("audit_logs").insert({
        ator_tipo: "anonimo",
        entidade: "simulado",
        entidade_id: s.id,
        acao: "acesso_link_publico",
        ip: (getRequestIP({ xForwardedFor: true }) as unknown as string) ?? null,
        user_agent: getRequestHeader("user-agent") ?? null,
        detalhes: { token: data.token, status: s.status } as never,
      });
    } catch {
      // ignora falhas de auditoria
    }

    return { found: true as const, simulado: s, server_now: new Date().toISOString() };
  });

const IniciarSchema = z.object({
  token: z.string().min(8).max(128).regex(/^[a-f0-9]+$/i),
  email: z.string().trim().email("E-mail inválido").max(255),
  nome: z.string().trim().max(120).optional().or(z.literal("")),
  cpf: z.string().trim().max(14).optional().or(z.literal("")),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
});

function normalizarCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/** Valida CPF brasileiro: formato + dígitos verificadores. */
function cpfValido(cpf: string): boolean {
  const c = normalizarCpf(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (base: string, fator: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * (fator - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return (
    calc(c.slice(0, 9), 10) === parseInt(c[9], 10) &&
    calc(c.slice(0, 10), 11) === parseInt(c[10], 10)
  );
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const iniciarSessaoPublica = createServerFn({ method: "POST" })
  .inputValidator((data) => IniciarSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Carrega simulado pelo token e valida
    const { data: s, error: e1 } = await supabaseAdmin
      .from("simulados")
      .select("id, status, duracao_minutos, data_inicio, data_fim, link_expira_em, link_revogado_em, permitir_retentativa, solicitar_nome, solicitar_cpf, solicitar_telefone, embaralhar_questoes, embaralhar_alternativas, permitir_atraso_entrada, tempo_maximo_atraso_minutos")
      .eq("token_acesso", data.token)
      .maybeSingle();
    if (e1) throw new Error("Falha ao carregar o simulado.");
    if (!s) throw new Error("Link inválido.");

    const v = linkValido(s);
    if (!v.ok) throw new Error(v.motivo);
    if (s.status !== "em_andamento") {
      throw new Error("O simulado ainda não está liberado para iniciar.");
    }
    if (s.data_fim && new Date(s.data_fim).getTime() <= Date.now()) {
      throw new Error("O tempo limite deste simulado já foi atingido. Não é mais possível iniciar.");
    }

    const email = data.email.toLowerCase();

    // Atalho de recuperação de sessão: se já existe sessão ativa para este e-mail
    // neste simulado, retorna imediatamente — sem revalidar campos obrigatórios
    // nem regra de atraso (sessões iniciadas nunca são bloqueadas).
    {
      const { data: estPrev } = await supabaseAdmin
        .from("estudantes")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (estPrev) {
        const { data: matrPrev } = await supabaseAdmin
          .from("matriculas")
          .select("id, liberado")
          .eq("estudante_id", estPrev.id)
          .eq("simulado_id", s.id)
          .maybeSingle();
        if (matrPrev?.liberado) {
          const { data: ativaPrev } = await supabaseAdmin
            .from("sessoes_prova")
            .select("id, status, expira_em")
            .eq("matricula_id", matrPrev.id)
            .eq("status", "ativa")
            .order("iniciada_em", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (ativaPrev && new Date(ativaPrev.expira_em).getTime() > Date.now()) {
            try {
              await supabaseAdmin.from("audit_logs").insert({
                ator_tipo: "estudante",
                ator_id: estPrev.id,
                entidade: "sessao_prova",
                entidade_id: ativaPrev.id,
                acao: "sessao.resume",
                detalhes: { simulado_id: s.id } as never,
              });
            } catch {
              // ignora
            }
            return { sessao_id: ativaPrev.id, simulado_id: s.id };
          }
        }
      }
    }

    // Validação condicional dos campos solicitados (somente para novas sessões)
    const sim = s as { solicitar_nome: boolean; solicitar_cpf: boolean; solicitar_telefone: boolean };
    if (sim.solicitar_nome && (!data.nome || data.nome.trim().length < 2)) {
      throw new Error("Nome obrigatório.");
    }
    if (sim.solicitar_cpf) {
      if (!cpfValido(data.cpf ?? "")) throw new Error("CPF inválido.");
    }
    if (sim.solicitar_telefone && (!data.telefone || data.telefone.trim().length < 8)) {
      throw new Error("Telefone obrigatório.");
    }

    const cpf = data.cpf ? normalizarCpf(data.cpf) : null;
    const nome = data.nome?.trim() || null;
    const telefone = data.telefone?.trim() || null;


    // 2) Upsert do estudante por e-mail
    const { data: existente } = await supabaseAdmin
      .from("estudantes")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let estudanteId: string;
    if (existente) {
      estudanteId = existente.id;
      const upd: { ultimo_acesso: string; nome?: string; cpf?: string; telefone?: string } = {
        ultimo_acesso: new Date().toISOString(),
      };
      if (nome) upd.nome = nome;
      if (cpf) upd.cpf = cpf;
      if (telefone) upd.telefone = telefone;
      await supabaseAdmin.from("estudantes").update(upd).eq("id", estudanteId);
    } else {
      const { data: novo, error: eIns } = await supabaseAdmin
        .from("estudantes")
        .insert({
          email,
          nome,
          cpf,
          telefone,
          ultimo_acesso: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (eIns || !novo) throw new Error("Não foi possível registrar o estudante.");
      estudanteId = novo.id;
    }

    // 3) Verifica matrícula (obrigatória — não cria automaticamente)
    const { data: matr } = await supabaseAdmin
      .from("matriculas")
      .select("id, liberado")
      .eq("estudante_id", estudanteId)
      .eq("simulado_id", s.id)
      .maybeSingle();

    if (!matr) {
      throw new Error(
        "Você não está matriculado neste simulado. Solicite ao organizador que matricule seu e-mail."
      );
    }
    if (!matr.liberado) {
      throw new Error("Sua matrícula neste simulado não está liberada.");
    }
    const matriculaId = matr.id;

    // 4) Reaproveita sessão ativa; bloqueia se já finalizada e não permitir retentativa
    const { data: sessoes } = await supabaseAdmin
      .from("sessoes_prova")
      .select("id, status, expira_em, finalizada_em")
      .eq("matricula_id", matriculaId)
      .order("iniciada_em", { ascending: false });

    const ativa = sessoes?.find((x) => x.status === "ativa");
    const finalizada = sessoes?.find((x) => x.status === "finalizada");

    let sessaoId: string;
    if (ativa) {
      sessaoId = ativa.id;
    } else if (finalizada && !(s as { permitir_retentativa?: boolean }).permitir_retentativa) {
      throw new Error(
        "Você já finalizou este simulado. Nova tentativa não está permitida.",
      );
    } else {
      // Bloqueio por atraso na entrada (apenas para novas sessões; nunca afeta sessões já iniciadas)
      const { verificarBloqueioPorAtraso } = await import("./simulados-publico.sanitize");
      const simReg = s as {
        permitir_atraso_entrada?: boolean;
        tempo_maximo_atraso_minutos?: number;
        data_inicio?: string | null;
      };
      const bloqueio = verificarBloqueioPorAtraso({
        data_inicio: simReg.data_inicio ?? null,
        permitir_atraso_entrada: simReg.permitir_atraso_entrada,
        tempo_maximo_atraso_minutos: simReg.tempo_maximo_atraso_minutos,
        agoraMs: Date.now(),
      });
      if (bloqueio.bloqueado) {
        throw new Error(
          "O prazo para iniciar este simulado já foi encerrado conforme as regras da aplicação.",
        );
      }
      const expiraEm = new Date(Date.now() + s.duracao_minutos * 60_000).toISOString();

      // Gera e persiste a ordem (questões + alternativas) para esta tentativa.
      // Embaralhamento ocorre UMA ÚNICA VEZ no início; recarregar a prova
      // mantém a mesma sequência.
      let ordem_questoes: {
        questoes?: string[];
        alternativas?: Record<string, string[]>;
      } | null = null;

      const flags = s as { embaralhar_questoes?: boolean; embaralhar_alternativas?: boolean };
      if (flags.embaralhar_questoes || flags.embaralhar_alternativas) {
        const { data: vincs } = await supabaseAdmin
          .from("questao_simulado")
          .select("ordem, questoes(id, alternativas(id))")
          .eq("simulado_id", s.id)
          .order("ordem");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lista = (vincs ?? []).filter((v: any) => v.questoes);
        ordem_questoes = {};
        if (flags.embaralhar_questoes) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ordem_questoes.questoes = shuffle(lista.map((v: any) => v.questoes.id as string));
        }
        if (flags.embaralhar_alternativas) {
          const alts: Record<string, string[]> = {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const v of lista as any[]) {
            const ids = (v.questoes.alternativas ?? []).map((a: { id: string }) => a.id);
            alts[v.questoes.id] = shuffle(ids);
          }
          ordem_questoes.alternativas = alts;
        }
      }

      const { data: nova, error: eS } = await supabaseAdmin
        .from("sessoes_prova")
        .insert({
          matricula_id: matriculaId,
          estudante_id: estudanteId,
          simulado_id: s.id,
          expira_em: expiraEm,
          ordem_questoes: ordem_questoes as never,
          ip_inicio: (getRequestIP({ xForwardedFor: true }) as unknown as string) ?? null,
        })
        .select("id")
        .single();
      if (eS || !nova) throw new Error("Falha ao iniciar a sessão.");
      sessaoId = nova.id;
    }

    // 5) Auditoria
    try {
      await supabaseAdmin.from("audit_logs").insert({
        ator_tipo: "estudante",
        ator_id: estudanteId,
        entidade: "sessao_prova",
        entidade_id: sessaoId,
        acao: "iniciar_sessao_publica",
        ip: (getRequestIP({ xForwardedFor: true }) as unknown as string) ?? null,
        user_agent: getRequestHeader("user-agent") ?? null,
        detalhes: { simulado_id: s.id, token: data.token } as never,
      });
    } catch {
      // ignora
    }

    return { sessao_id: sessaoId, simulado_id: s.id };
  });

const SessaoSchema = z.object({
  token: z.string().min(8).max(128).regex(/^[a-f0-9]+$/i),
  sessao_id: z.string().uuid(),
});

export const getProvaPorSessao = createServerFn({ method: "POST" })
  .inputValidator((data) => SessaoSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sessao, error: eS } = await supabaseAdmin
      .from("sessoes_prova")
      .select("id, status, expira_em, iniciada_em, finalizada_em, ordem_questoes, ultima_questao_idx, simulado_id, estudante_id, simulados!inner(id, titulo, descricao, instrucoes, duracao_minutos, embaralhar_questoes, embaralhar_alternativas, permitir_revisao, mostrar_gabarito, mostrar_resultado, permitir_retentativa, mostrar_feedbacks, token_acesso, data_inicio, data_fim, permitir_atraso_entrada, tempo_maximo_atraso_minutos, exibir_popup_atraso, tempo_popup_atraso_minutos)")
      .eq("id", data.sessao_id)
      .maybeSingle();

    if (eS) throw new Error("Falha ao carregar a sessão.");
    if (!sessao) throw new Error("Sessão não encontrada.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sim = (sessao as any).simulados;
    if (!sim || sim.token_acesso !== data.token) {
      throw new Error("Token não corresponde à sessão.");
    }

    const { data: vinculos, error: eV } = await supabaseAdmin
      .from("questao_simulado")
      .select("ordem, peso, questoes(id, enunciado, disciplina, topico, dificuldade, explicacao, alternativas(id, letra, texto, correta))")
      .eq("simulado_id", sim.id)
      .order("ordem");
    if (eV) throw new Error("Falha ao carregar questões.");

    const { data: respostas } = await supabaseAdmin
      .from("respostas")
      .select("questao_id, alternativa_id")
      .eq("sessao_id", sessao.id);

    const {
      sanitizeVinculos,
      sanitizeRespostas,
      sanitizeSimuladoForStudent,
      sanitizeSimuladoComGabarito,
      aplicarOrdemPersistida,
    } = await import("./simulados-publico.sanitize");

    // Gabarito só é revelado quando: organizador habilitou + sessão finalizada.
    const revelarGabarito =
      !!sim.mostrar_gabarito && sessao.status === "finalizada";

    const vincSan = sanitizeVinculos(vinculos ?? [], {
      includeGabarito: revelarGabarito,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ordem = (sessao as any).ordem_questoes as
      | { questoes?: string[]; alternativas?: Record<string, string[]> }
      | null;

    return {
      server_now: new Date().toISOString(),
      sessao: {
        id: sessao.id,
        status: sessao.status,
        expira_em: sessao.expira_em,
        iniciada_em: sessao.iniciada_em,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finalizada_em: (sessao as any).finalizada_em ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ultima_questao_idx: Number((sessao as any).ultima_questao_idx ?? 0),
      },
      simulado: revelarGabarito
        ? sanitizeSimuladoComGabarito(sim)
        : sanitizeSimuladoForStudent(sim),
      vinculos: aplicarOrdemPersistida(vincSan, ordem),
      respostas: sanitizeRespostas(respostas ?? []),
    };
  });

const SalvarPosicaoSchema = SessaoSchema.extend({
  questao_idx: z.number().int().min(0).max(10_000),
});

/**
 * Persiste no servidor o índice da última questão vista pelo estudante.
 * Permite recuperar a posição exata após queda de conexão / refresh.
 */
export const salvarPosicaoQuestao = createServerFn({ method: "POST" })
  .inputValidator((data) => SalvarPosicaoSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sessao } = await supabaseAdmin
      .from("sessoes_prova")
      .select("id, status, simulados!inner(token_acesso)")
      .eq("id", data.sessao_id)
      .maybeSingle();
    if (!sessao) throw new Error("Sessão não encontrada.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((sessao as any).simulados?.token_acesso !== data.token) {
      throw new Error("Token inválido.");
    }
    if (sessao.status !== "ativa") return { ok: true as const };

    await supabaseAdmin
      .from("sessoes_prova")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ ultima_questao_idx: data.questao_idx } as any)
      .eq("id", data.sessao_id);

    return { ok: true as const };
  });


const SalvarSchema = SessaoSchema.extend({
  questao_id: z.string().uuid(),
  alternativa_id: z.string().uuid().nullable(),
  tempo_gasto_segundos: z.number().int().min(0).max(86400).optional(),
});

export const salvarResposta = createServerFn({ method: "POST" })
  .inputValidator((data) => SalvarSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sessao } = await supabaseAdmin
      .from("sessoes_prova")
      .select("id, status, expira_em, simulados!inner(token_acesso)")
      .eq("id", data.sessao_id)
      .maybeSingle();
    if (!sessao) throw new Error("Sessão não encontrada.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((sessao as any).simulados?.token_acesso !== data.token) {
      throw new Error("Token inválido.");
    }
    if (sessao.status !== "ativa") throw new Error("Sessão já encerrada.");
    if (new Date(sessao.expira_em).getTime() < Date.now()) {
      throw new Error("O tempo desta sessão expirou.");
    }

    let correta: boolean | null = null;
    if (data.alternativa_id) {
      const { data: alt } = await supabaseAdmin
        .from("alternativas")
        .select("correta, questao_id")
        .eq("id", data.alternativa_id)
        .maybeSingle();
      if (!alt || alt.questao_id !== data.questao_id) {
        throw new Error("Alternativa inválida para a questão.");
      }
      correta = alt.correta;
    }

    const { data: existente } = await supabaseAdmin
      .from("respostas")
      .select("id")
      .eq("sessao_id", data.sessao_id)
      .eq("questao_id", data.questao_id)
      .maybeSingle();

    if (existente) {
      await supabaseAdmin
        .from("respostas")
        .update({
          alternativa_id: data.alternativa_id,
          correta,
          tempo_gasto_segundos: data.tempo_gasto_segundos ?? null,
          marcada_em: new Date().toISOString(),
        })
        .eq("id", existente.id);
    } else {
      await supabaseAdmin.from("respostas").insert({
        sessao_id: data.sessao_id,
        questao_id: data.questao_id,
        alternativa_id: data.alternativa_id,
        correta,
        tempo_gasto_segundos: data.tempo_gasto_segundos ?? null,
      });
    }

    await supabaseAdmin
      .from("sessoes_prova")
      .update({ ultima_heartbeat: new Date().toISOString() })
      .eq("id", data.sessao_id);

    return { ok: true };
  });

export const finalizarSessao = createServerFn({ method: "POST" })
  .inputValidator((data) => SessaoSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sessao } = await supabaseAdmin
      .from("sessoes_prova")
      .select("id, status, simulado_id, simulados!inner(token_acesso, mostrar_resultado)")
      .eq("id", data.sessao_id)
      .maybeSingle();
    if (!sessao) throw new Error("Sessão não encontrada.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simRef = (sessao as any).simulados;
    if (simRef?.token_acesso !== data.token) {
      throw new Error("Token inválido.");
    }

    const { data: vinculos } = await supabaseAdmin
      .from("questao_simulado")
      .select("questao_id, peso")
      .eq("simulado_id", sessao.simulado_id);

    const totalQuestoes = vinculos?.length ?? 0;
    const pesoTotal = (vinculos ?? []).reduce((s, v) => s + Number(v.peso), 0);

    const { data: respostas } = await supabaseAdmin
      .from("respostas")
      .select("questao_id, correta")
      .eq("sessao_id", data.sessao_id);

    const pesoMap = new Map((vinculos ?? []).map((v) => [v.questao_id, Number(v.peso)]));
    let acertos = 0;
    let pontuacao = 0;
    for (const r of respostas ?? []) {
      if (r.correta) {
        acertos += 1;
        pontuacao += pesoMap.get(r.questao_id) ?? 0;
      }
    }
    const respondidas = (respostas ?? []).filter((r) => r.questao_id).length;

    if (sessao.status === "ativa") {
      await supabaseAdmin
        .from("sessoes_prova")
        .update({
          status: "finalizada",
          finalizada_em: new Date().toISOString(),
          acertos,
          total_questoes: totalQuestoes,
          pontuacao,
        })
        .eq("id", data.sessao_id);
    }

    // Quando o organizador desabilita "mostrar_resultado", o estudante
    // recebe apenas a confirmação de envio — sem nota, acertos ou peso.
    if (!simRef.mostrar_resultado) {
      return { questoesRespondidas: respondidas, ok: true as const };
    }

    return {
      acertos,
      erros: Math.max(0, respondidas - acertos),
      total_questoes: totalQuestoes,
      questoesRespondidas: respondidas,
      pontuacao,
      peso_total: pesoTotal,
      aproveitamento: totalQuestoes > 0
        ? Math.round((acertos / totalQuestoes) * 1000) / 10
        : 0,
      ok: true as const,
    };
  });

// ============ FEEDBACKS DE QUESTÃO (público, vinculado à sessão) ============

const FEEDBACK_TIPOS = [
  "reportar_erro",
  "duplicada",
  "desatualizada",
  "gabarito_incorreto",
  "enunciado_confuso",
  "alternativa_incorreta",
  "comentario_incorreto",
] as const;

const FeedbackQuestaoSchema = SessaoSchema.extend({
  questao_id: z.string().uuid(),
});

const CriarFeedbackSchema = FeedbackQuestaoSchema.extend({
  tipo: z.enum(FEEDBACK_TIPOS),
  mensagem: z.string().trim().min(3, "Descreva o feedback.").max(2000),
});

async function validarSessaoQuestao(
  token: string,
  sessao_id: string,
  questao_id: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sessao } = await supabaseAdmin
    .from("sessoes_prova")
    .select("id, estudante_id, simulado_id, simulados!inner(token_acesso, mostrar_feedbacks)")
    .eq("id", sessao_id)
    .maybeSingle();
  if (!sessao) throw new Error("Sessão não encontrada.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sim = (sessao as any).simulados;
  if (sim?.token_acesso !== token) throw new Error("Token inválido.");
  if (sim?.mostrar_feedbacks === false) {
    throw new Error("Feedbacks não estão habilitados neste simulado.");
  }
  const { data: vinculo } = await supabaseAdmin
    .from("questao_simulado")
    .select("id")
    .eq("simulado_id", sessao.simulado_id)
    .eq("questao_id", questao_id)
    .maybeSingle();
  if (!vinculo) throw new Error("Questão não pertence a este simulado.");
  return { sessao, supabaseAdmin };
}

export const listarFeedbacksQuestao = createServerFn({ method: "POST" })
  .inputValidator((data) => FeedbackQuestaoSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await validarSessaoQuestao(
      data.token, data.sessao_id, data.questao_id,
    );
    const { data: lista } = await supabaseAdmin
      .from("feedbacks_questao")
      .select("id, tipo, mensagem, resposta_admin, resolvido, created_at, estudante_id")
      .eq("questao_id", data.questao_id)
      .order("created_at", { ascending: false })
      .limit(50);
    return { feedbacks: lista ?? [] };
  });

export const criarFeedbackQuestao = createServerFn({ method: "POST" })
  .inputValidator((data) => CriarFeedbackSchema.parse(data))
  .handler(async ({ data }) => {
    const { sessao, supabaseAdmin } = await validarSessaoQuestao(
      data.token, data.sessao_id, data.questao_id,
    );
    const { data: novo, error } = await supabaseAdmin
      .from("feedbacks_questao")
      .insert({
        questao_id: data.questao_id,
        sessao_id: sessao.id,
        estudante_id: sessao.estudante_id,
        tipo: data.tipo,
        mensagem: data.mensagem,
      })
      .select("id, tipo, mensagem, resposta_admin, resolvido, created_at, estudante_id")
      .single();
    if (error || !novo) throw new Error("Não foi possível registrar o feedback.");
    return { feedback: novo };
  });
