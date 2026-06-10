export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      administradores: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alternativas: {
        Row: {
          correta: boolean
          created_at: string
          id: string
          letra: string
          questao_id: string
          texto: string
        }
        Insert: {
          correta?: boolean
          created_at?: string
          id?: string
          letra: string
          questao_id: string
          texto: string
        }
        Update: {
          correta?: boolean
          created_at?: string
          id?: string
          letra?: string
          questao_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "alternativas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          ator_id: string | null
          ator_tipo: string
          created_at: string
          detalhes: Json | null
          entidade: string
          entidade_id: string | null
          id: string
          ip: unknown
          user_agent: string | null
        }
        Insert: {
          acao: string
          ator_id?: string | null
          ator_tipo: string
          created_at?: string
          detalhes?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
          ip?: unknown
          user_agent?: string | null
        }
        Update: {
          acao?: string
          ator_id?: string | null
          ator_tipo?: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          ip?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      estudantes: {
        Row: {
          cpf: string | null
          created_at: string
          device_hash: string | null
          email: string
          id: string
          nome: string | null
          primeiro_acesso: string
          telefone: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          device_hash?: string | null
          email: string
          id?: string
          nome?: string | null
          primeiro_acesso?: string
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          device_hash?: string | null
          email?: string
          id?: string
          nome?: string | null
          primeiro_acesso?: string
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      feedbacks_questao: {
        Row: {
          created_at: string
          estudante_id: string | null
          id: string
          mensagem: string
          questao_id: string
          resolvido: boolean
          resposta_admin: string | null
          sessao_id: string | null
          tipo: Database["public"]["Enums"]["feedback_tipo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          estudante_id?: string | null
          id?: string
          mensagem: string
          questao_id: string
          resolvido?: boolean
          resposta_admin?: string | null
          sessao_id?: string | null
          tipo: Database["public"]["Enums"]["feedback_tipo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          estudante_id?: string | null
          id?: string
          mensagem?: string
          questao_id?: string
          resolvido?: boolean
          resposta_admin?: string | null
          sessao_id?: string | null
          tipo?: Database["public"]["Enums"]["feedback_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_questao_estudante_id_fkey"
            columns: ["estudante_id"]
            isOneToOne: false
            referencedRelation: "estudantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_questao_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_questao_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes_prova"
            referencedColumns: ["id"]
          },
        ]
      }
      grupo_membros: {
        Row: {
          created_at: string
          estudante_id: string
          grupo_id: string
          id: string
        }
        Insert: {
          created_at?: string
          estudante_id: string
          grupo_id: string
          id?: string
        }
        Update: {
          created_at?: string
          estudante_id?: string
          grupo_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_membros_estudante_id_fkey"
            columns: ["estudante_id"]
            isOneToOne: false
            referencedRelation: "estudantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupo_membros_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      grupo_simulado: {
        Row: {
          created_at: string
          grupo_id: string
          id: string
          simulado_id: string
        }
        Insert: {
          created_at?: string
          grupo_id: string
          id?: string
          simulado_id: string
        }
        Update: {
          created_at?: string
          grupo_id?: string
          id?: string
          simulado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_simulado_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupo_simulado_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos: {
        Row: {
          arquivado: boolean
          cor: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          arquivado?: boolean
          cor?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          arquivado?: boolean
          cor?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          arquivo_nome: string | null
          created_at: string
          erros: Json | null
          id: string
          iniciado_por: string | null
          linhas_erro: number
          linhas_ok: number
          status: Database["public"]["Enums"]["import_status"]
          tipo: string
          total_linhas: number | null
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          created_at?: string
          erros?: Json | null
          id?: string
          iniciado_por?: string | null
          linhas_erro?: number
          linhas_ok?: number
          status?: Database["public"]["Enums"]["import_status"]
          tipo: string
          total_linhas?: number | null
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          created_at?: string
          erros?: Json | null
          id?: string
          iniciado_por?: string | null
          linhas_erro?: number
          linhas_ok?: number
          status?: Database["public"]["Enums"]["import_status"]
          tipo?: string
          total_linhas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_iniciado_por_fkey"
            columns: ["iniciado_por"]
            isOneToOne: false
            referencedRelation: "administradores"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          created_at: string
          estudante_id: string
          id: string
          liberado: boolean
          simulado_id: string
        }
        Insert: {
          created_at?: string
          estudante_id: string
          id?: string
          liberado?: boolean
          simulado_id: string
        }
        Update: {
          created_at?: string
          estudante_id?: string
          id?: string
          liberado?: boolean
          simulado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_estudante_id_fkey"
            columns: ["estudante_id"]
            isOneToOne: false
            referencedRelation: "estudantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      pastas: {
        Row: {
          arquivada: boolean
          cor: string | null
          created_at: string
          criada_por: string | null
          descricao: string | null
          id: string
          nome: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          arquivada?: boolean
          cor?: string | null
          created_at?: string
          criada_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          arquivada?: boolean
          cor?: string | null
          created_at?: string
          criada_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pastas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      questao_pasta: {
        Row: {
          created_at: string
          id: string
          pasta_id: string
          questao_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pasta_id: string
          questao_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pasta_id?: string
          questao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questao_pasta_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "pastas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questao_pasta_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      questao_simulado: {
        Row: {
          id: string
          ordem: number
          peso: number
          questao_id: string
          simulado_id: string
        }
        Insert: {
          id?: string
          ordem: number
          peso?: number
          questao_id: string
          simulado_id: string
        }
        Update: {
          id?: string
          ordem?: number
          peso?: number
          questao_id?: string
          simulado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questao_simulado_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questao_simulado_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      questoes: {
        Row: {
          area: string | null
          assunto: string | null
          ativa: boolean
          codigo_externo: string | null
          created_at: string
          criada_por: string | null
          dificuldade: number | null
          disciplina: string | null
          enunciado: string
          explicacao: string | null
          fonte: string | null
          id: string
          pasta_id: string | null
          status: Database["public"]["Enums"]["questao_status"]
          topico: string | null
          updated_at: string
        }
        Insert: {
          area?: string | null
          assunto?: string | null
          ativa?: boolean
          codigo_externo?: string | null
          created_at?: string
          criada_por?: string | null
          dificuldade?: number | null
          disciplina?: string | null
          enunciado: string
          explicacao?: string | null
          fonte?: string | null
          id?: string
          pasta_id?: string | null
          status?: Database["public"]["Enums"]["questao_status"]
          topico?: string | null
          updated_at?: string
        }
        Update: {
          area?: string | null
          assunto?: string | null
          ativa?: boolean
          codigo_externo?: string | null
          created_at?: string
          criada_por?: string | null
          dificuldade?: number | null
          disciplina?: string | null
          enunciado?: string
          explicacao?: string | null
          fonte?: string | null
          id?: string
          pasta_id?: string | null
          status?: Database["public"]["Enums"]["questao_status"]
          topico?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questoes_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "administradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas: {
        Row: {
          alternativa_id: string | null
          correta: boolean | null
          id: string
          marcada_em: string
          questao_id: string
          sessao_id: string
          tempo_gasto_segundos: number | null
        }
        Insert: {
          alternativa_id?: string | null
          correta?: boolean | null
          id?: string
          marcada_em?: string
          questao_id: string
          sessao_id: string
          tempo_gasto_segundos?: number | null
        }
        Update: {
          alternativa_id?: string | null
          correta?: boolean | null
          id?: string
          marcada_em?: string
          questao_id?: string
          sessao_id?: string
          tempo_gasto_segundos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "respostas_alternativa_id_fkey"
            columns: ["alternativa_id"]
            isOneToOne: false
            referencedRelation: "alternativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes_prova"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes_prova: {
        Row: {
          acertos: number | null
          created_at: string
          device_hash: string | null
          estudante_id: string
          expira_em: string
          finalizada_em: string | null
          id: string
          iniciada_em: string
          ip_inicio: unknown
          matricula_id: string
          ordem_questoes: Json | null
          pontuacao: number | null
          simulado_id: string
          status: Database["public"]["Enums"]["sessao_status"]
          total_questoes: number | null
          ultima_heartbeat: string | null
          ultima_questao_idx: number
          updated_at: string
        }
        Insert: {
          acertos?: number | null
          created_at?: string
          device_hash?: string | null
          estudante_id: string
          expira_em: string
          finalizada_em?: string | null
          id?: string
          iniciada_em?: string
          ip_inicio?: unknown
          matricula_id: string
          ordem_questoes?: Json | null
          pontuacao?: number | null
          simulado_id: string
          status?: Database["public"]["Enums"]["sessao_status"]
          total_questoes?: number | null
          ultima_heartbeat?: string | null
          ultima_questao_idx?: number
          updated_at?: string
        }
        Update: {
          acertos?: number | null
          created_at?: string
          device_hash?: string | null
          estudante_id?: string
          expira_em?: string
          finalizada_em?: string | null
          id?: string
          iniciada_em?: string
          ip_inicio?: unknown
          matricula_id?: string
          ordem_questoes?: Json | null
          pontuacao?: number | null
          simulado_id?: string
          status?: Database["public"]["Enums"]["sessao_status"]
          total_questoes?: number | null
          ultima_heartbeat?: string | null
          ultima_questao_idx?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_prova_estudante_id_fkey"
            columns: ["estudante_id"]
            isOneToOne: false
            referencedRelation: "estudantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_prova_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_prova_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      simulados: {
        Row: {
          created_at: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          duracao_minutos: number
          embaralhar_alternativas: boolean
          embaralhar_questoes: boolean
          exibir_popup_atraso: boolean
          id: string
          instrucoes: string | null
          link_expira_em: string | null
          link_revogado_em: string | null
          mostrar_feedbacks: boolean
          mostrar_gabarito: boolean
          mostrar_resultado: boolean
          permitir_atraso_entrada: boolean
          permitir_retentativa: boolean
          permitir_revisao: boolean
          solicitar_cpf: boolean
          solicitar_nome: boolean
          solicitar_telefone: boolean
          status: Database["public"]["Enums"]["simulado_status"]
          tempo_maximo_atraso_minutos: number
          tempo_popup_atraso_minutos: number
          titulo: string
          token_acesso: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          duracao_minutos: number
          embaralhar_alternativas?: boolean
          embaralhar_questoes?: boolean
          exibir_popup_atraso?: boolean
          id?: string
          instrucoes?: string | null
          link_expira_em?: string | null
          link_revogado_em?: string | null
          mostrar_feedbacks?: boolean
          mostrar_gabarito?: boolean
          mostrar_resultado?: boolean
          permitir_atraso_entrada?: boolean
          permitir_retentativa?: boolean
          permitir_revisao?: boolean
          solicitar_cpf?: boolean
          solicitar_nome?: boolean
          solicitar_telefone?: boolean
          status?: Database["public"]["Enums"]["simulado_status"]
          tempo_maximo_atraso_minutos?: number
          tempo_popup_atraso_minutos?: number
          titulo: string
          token_acesso?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          duracao_minutos?: number
          embaralhar_alternativas?: boolean
          embaralhar_questoes?: boolean
          exibir_popup_atraso?: boolean
          id?: string
          instrucoes?: string | null
          link_expira_em?: string | null
          link_revogado_em?: string | null
          mostrar_feedbacks?: boolean
          mostrar_gabarito?: boolean
          mostrar_resultado?: boolean
          permitir_atraso_entrada?: boolean
          permitir_retentativa?: boolean
          permitir_revisao?: boolean
          solicitar_cpf?: boolean
          solicitar_nome?: boolean
          solicitar_telefone?: boolean
          status?: Database["public"]["Enums"]["simulado_status"]
          tempo_maximo_atraso_minutos?: number
          tempo_popup_atraso_minutos?: number
          titulo?: string
          token_acesso?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulados_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "administradores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validar_questoes_simulado: {
        Args: { _simulado_id: string }
        Returns: {
          detalhe: string
          problema: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "estudante"
      feedback_tipo:
        | "duvida"
        | "erro"
        | "sugestao"
        | "elogio"
        | "reportar_erro"
        | "duplicada"
        | "desatualizada"
        | "gabarito_incorreto"
        | "enunciado_confuso"
        | "alternativa_incorreta"
        | "comentario_incorreto"
      import_status: "pendente" | "processando" | "concluido" | "falhou"
      questao_status: "ativa" | "em_revisao" | "arquivada"
      sessao_status: "ativa" | "finalizada" | "expirada" | "cancelada"
      simulado_status:
        | "rascunho"
        | "agendado"
        | "em_andamento"
        | "encerrado"
        | "arquivado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "estudante"],
      feedback_tipo: [
        "duvida",
        "erro",
        "sugestao",
        "elogio",
        "reportar_erro",
        "duplicada",
        "desatualizada",
        "gabarito_incorreto",
        "enunciado_confuso",
        "alternativa_incorreta",
        "comentario_incorreto",
      ],
      import_status: ["pendente", "processando", "concluido", "falhou"],
      questao_status: ["ativa", "em_revisao", "arquivada"],
      sessao_status: ["ativa", "finalizada", "expirada", "cancelada"],
      simulado_status: [
        "rascunho",
        "agendado",
        "em_andamento",
        "encerrado",
        "arquivado",
      ],
    },
  },
} as const
