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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      aportes: {
        Row: {
          conta_id: number | null
          created_at: string | null
          data_aporte: string | null
          id: number
          matriz_id: number | null
          observacoes: string | null
          socio_id: number | null
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          conta_id?: number | null
          created_at?: string | null
          data_aporte?: string | null
          id?: number
          matriz_id?: number | null
          observacoes?: string | null
          socio_id?: number | null
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          conta_id?: number | null
          created_at?: string | null
          data_aporte?: string | null
          id?: number
          matriz_id?: number | null
          observacoes?: string | null
          socio_id?: number | null
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      app_users: {
        Row: {
          created_at: string | null
          email: string | null
          encrypted_password: string | null
          id: number
          last_login_at: string | null
          name: string | null
          password_reset_expires_at: string | null
          password_reset_token: string | null
          phone: string | null
          role: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          encrypted_password?: string | null
          id?: number
          last_login_at?: string | null
          name?: string | null
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          encrypted_password?: string | null
          id?: number
          last_login_at?: string | null
          name?: string | null
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      auditoria_fornecedor_historico_pagamentos: {
        Row: {
          auditoria_item_id: number
          auditoria_item_parcela_id: number | null
          created_at: string
          data_pagamento: string
          id: number
          numero_parcela: number
          observacao: string | null
          status: string
          usuario_id: number | null
          valor_pago: number
        }
        Insert: {
          auditoria_item_id: number
          auditoria_item_parcela_id?: number | null
          created_at?: string
          data_pagamento: string
          id?: number
          numero_parcela: number
          observacao?: string | null
          status?: string
          usuario_id?: number | null
          valor_pago: number
        }
        Update: {
          auditoria_item_id?: number
          auditoria_item_parcela_id?: number | null
          created_at?: string
          data_pagamento?: string
          id?: number
          numero_parcela?: number
          observacao?: string | null
          status?: string
          usuario_id?: number | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_fornecedor_historico_p_auditoria_item_parcela_id_fkey"
            columns: ["auditoria_item_parcela_id"]
            isOneToOne: false
            referencedRelation: "auditoria_fornecedor_item_parcelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_fornecedor_historico_pagamento_auditoria_item_id_fkey"
            columns: ["auditoria_item_id"]
            isOneToOne: false
            referencedRelation: "auditoria_fornecedor_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_fornecedor_historico_pagamentos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_fornecedor_item_parcelas: {
        Row: {
          auditoria_item_id: number
          created_at: string
          data_pagamento: string | null
          data_registro_baixa: string | null
          id: number
          numero_parcela: number
          observacao: string | null
          status: string
          updated_at: string
          usuario_id: number | null
          valor_parcela: number
        }
        Insert: {
          auditoria_item_id: number
          created_at?: string
          data_pagamento?: string | null
          data_registro_baixa?: string | null
          id?: number
          numero_parcela: number
          observacao?: string | null
          status?: string
          updated_at?: string
          usuario_id?: number | null
          valor_parcela?: number
        }
        Update: {
          auditoria_item_id?: number
          created_at?: string
          data_pagamento?: string | null
          data_registro_baixa?: string | null
          id?: number
          numero_parcela?: number
          observacao?: string | null
          status?: string
          updated_at?: string
          usuario_id?: number | null
          valor_parcela?: number
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_fornecedor_item_parcelas_auditoria_item_id_fkey"
            columns: ["auditoria_item_id"]
            isOneToOne: false
            referencedRelation: "auditoria_fornecedor_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_fornecedor_item_parcelas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_fornecedor_itens: {
        Row: {
          auditado: boolean | null
          auditoria_id: number
          created_at: string
          data_emissao: string | null
          fornecedor_subcontratado_id: number
          id: number
          observacoes: string | null
          parcelas: number
          projeto_id: number | null
          status_pagamento: string
          updated_at: string
          valor_a_pagar: number
          valor_pago: number
          valor_total: number
        }
        Insert: {
          auditado?: boolean | null
          auditoria_id: number
          created_at?: string
          data_emissao?: string | null
          fornecedor_subcontratado_id: number
          id?: number
          observacoes?: string | null
          parcelas?: number
          projeto_id?: number | null
          status_pagamento?: string
          updated_at?: string
          valor_a_pagar?: number
          valor_pago?: number
          valor_total?: number
        }
        Update: {
          auditado?: boolean | null
          auditoria_id?: number
          created_at?: string
          data_emissao?: string | null
          fornecedor_subcontratado_id?: number
          id?: number
          observacoes?: string | null
          parcelas?: number
          projeto_id?: number | null
          status_pagamento?: string
          updated_at?: string
          valor_a_pagar?: number
          valor_pago?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_fornecedor_itens_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_fornecedor_itens_fornecedor_subcontratado_id_fkey"
            columns: ["fornecedor_subcontratado_id"]
            isOneToOne: false
            referencedRelation: "fornecedores_subcontratados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_fornecedor_itens_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditorias_fornecedores: {
        Row: {
          created_at: string
          created_by_user_id: number | null
          data_auditoria: string
          id: number
          quantidade_itens: number
          status: string
          updated_at: string
          updated_by_user_id: number | null
          valor_a_pagar: number
          valor_pago: number
          valor_total: number
        }
        Insert: {
          created_at?: string
          created_by_user_id?: number | null
          data_auditoria: string
          id?: number
          quantidade_itens?: number
          status?: string
          updated_at?: string
          updated_by_user_id?: number | null
          valor_a_pagar?: number
          valor_pago?: number
          valor_total?: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: number | null
          data_auditoria?: string
          id?: number
          quantidade_itens?: number
          status?: string
          updated_at?: string
          updated_by_user_id?: number | null
          valor_a_pagar?: number
          valor_pago?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "auditorias_fornecedores_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditorias_fornecedores_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          active: boolean | null
          address: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          file_urls: string[] | null
          id: number
          name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          file_urls?: string[] | null
          id?: number
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          file_urls?: string[] | null
          id?: number
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      conciliacoes_extrato: {
        Row: {
          conciliado: boolean
          conciliado_em: string | null
          conciliado_por: string | null
          conta_id: number
          id: number
          origem: string
          origem_id: number
        }
        Insert: {
          conciliado?: boolean
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_id: number
          id?: number
          origem: string
          origem_id: number
        }
        Update: {
          conciliado?: boolean
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_id?: number
          id?: number
          origem?: string
          origem_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "conciliacoes_extrato_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      conta_pagar_orcamento_alocacao: {
        Row: {
          conta_pagar_id: number
          created_at: string | null
          id: number
          observacoes: string | null
          orcamento_id: number
          updated_at: string | null
          valor_alocado: number
        }
        Insert: {
          conta_pagar_id: number
          created_at?: string | null
          id?: number
          observacoes?: string | null
          orcamento_id: number
          updated_at?: string | null
          valor_alocado?: number
        }
        Update: {
          conta_pagar_id?: number
          created_at?: string | null
          id?: number
          observacoes?: string | null
          orcamento_id?: number
          updated_at?: string | null
          valor_alocado?: number
        }
        Relationships: [
          {
            foreignKeyName: "conta_pagar_orcamento_alocacao_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conta_pagar_orcamento_alocacao_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conta_pagar_orcamento_alocacao_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos_executado"
            referencedColumns: ["id"]
          },
        ]
      }
      contas: {
        Row: {
          banco: string | null
          created_at: string | null
          data_saldo_inicial: string | null
          descricao: string | null
          destaque: boolean | null
          id: number
          nome: string | null
          numero: string | null
          saldo_inicial: number | null
          updated_at: string | null
        }
        Insert: {
          banco?: string | null
          created_at?: string | null
          data_saldo_inicial?: string | null
          descricao?: string | null
          destaque?: boolean | null
          id?: number
          nome?: string | null
          numero?: string | null
          saldo_inicial?: number | null
          updated_at?: string | null
        }
        Update: {
          banco?: string | null
          created_at?: string | null
          data_saldo_inicial?: string | null
          descricao?: string | null
          destaque?: boolean | null
          id?: number
          nome?: string | null
          numero?: string | null
          saldo_inicial?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contas_pagar: {
        Row: {
          created_at: string | null
          data_competencia: string | null
          data_emissao: string | null
          data_vencimento: string | null
          entity_id: number | null
          entity_type: string | null
          fornecedor_id: number | null
          id: number
          matriz_id: number | null
          numero_documento: string | null
          observacoes: string | null
          status: string | null
          tipo_documento_id: number | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          data_competencia?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          entity_id?: number | null
          entity_type?: string | null
          fornecedor_id?: number | null
          id?: number
          matriz_id?: number | null
          numero_documento?: string | null
          observacoes?: string | null
          status?: string | null
          tipo_documento_id?: number | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          data_competencia?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          entity_id?: number | null
          entity_type?: string | null
          fornecedor_id?: number | null
          id?: number
          matriz_id?: number | null
          numero_documento?: string | null
          observacoes?: string | null
          status?: string | null
          tipo_documento_id?: number | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      contas_pagar_itens: {
        Row: {
          conta_pagar_id: number | null
          created_at: string | null
          id: number
          produto_id: number | null
          quantidade: number | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          conta_pagar_id?: number | null
          created_at?: string | null
          id?: number
          produto_id?: number | null
          quantidade?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          conta_pagar_id?: number | null
          created_at?: string | null
          id?: number
          produto_id?: number | null
          quantidade?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: []
      }
      contas_pagar_projetos: {
        Row: {
          conta_pagar_id: number
          created_at: string | null
          id: number
          percentual: number | null
          projeto_id: number
          valor_alocado: number
          valor_rateio: number | null
        }
        Insert: {
          conta_pagar_id: number
          created_at?: string | null
          id?: number
          percentual?: number | null
          projeto_id: number
          valor_alocado?: number
          valor_rateio?: number | null
        }
        Update: {
          conta_pagar_id?: number
          created_at?: string | null
          id?: number
          percentual?: number | null
          projeto_id?: number
          valor_alocado?: number
          valor_rateio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_projetos_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_projetos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_receber: {
        Row: {
          cliente_id: number | null
          created_at: string | null
          data_competencia: string | null
          data_emissao: string | null
          data_vencimento: string | null
          entity_id: number | null
          entity_type: string | null
          id: number
          matriz_id: number | null
          numero_documento: string | null
          observacoes: string | null
          status: string | null
          tipo_documento_id: number | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          cliente_id?: number | null
          created_at?: string | null
          data_competencia?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          entity_id?: number | null
          entity_type?: string | null
          id?: number
          matriz_id?: number | null
          numero_documento?: string | null
          observacoes?: string | null
          status?: string | null
          tipo_documento_id?: number | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          cliente_id?: number | null
          created_at?: string | null
          data_competencia?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          entity_id?: number | null
          entity_type?: string | null
          id?: number
          matriz_id?: number | null
          numero_documento?: string | null
          observacoes?: string | null
          status?: string | null
          tipo_documento_id?: number | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      contas_receber_faturamento: {
        Row: {
          conta_receber_id: number
          created_at: string
          id: number
          observacoes: string | null
          projeto_id: number
          updated_at: string
          valor_faturamento: number
        }
        Insert: {
          conta_receber_id: number
          created_at?: string
          id?: never
          observacoes?: string | null
          projeto_id: number
          updated_at?: string
          valor_faturamento: number
        }
        Update: {
          conta_receber_id?: number
          created_at?: string
          id?: never
          observacoes?: string | null
          projeto_id?: number
          updated_at?: string
          valor_faturamento?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_contas_receber_faturamento_projeto"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_receber_itens: {
        Row: {
          conta_receber_id: number | null
          created_at: string | null
          id: number
          produto_id: number | null
          quantidade: number | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          conta_receber_id?: number | null
          created_at?: string | null
          id?: number
          produto_id?: number | null
          quantidade?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          conta_receber_id?: number | null
          created_at?: string | null
          id?: number
          produto_id?: number | null
          quantidade?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: []
      }
      contas_receber_projetos: {
        Row: {
          conta_receber_id: number
          created_at: string | null
          id: number
          percentual: number | null
          projeto_id: number
          valor_alocado: number
          valor_rateio: number | null
        }
        Insert: {
          conta_receber_id: number
          created_at?: string | null
          id?: number
          percentual?: number | null
          projeto_id: number
          valor_alocado?: number
          valor_rateio?: number | null
        }
        Update: {
          conta_receber_id?: number
          created_at?: string | null
          id?: number
          percentual?: number | null
          projeto_id?: number
          valor_alocado?: number
          valor_rateio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_receber_projetos_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_projetos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_clientes: {
        Row: {
          cliente_id: number | null
          created_at: string | null
          empresa_id: number | null
          id: number
          percentage: number | null
        }
        Insert: {
          cliente_id?: number | null
          created_at?: string | null
          empresa_id?: number | null
          id?: number
          percentage?: number | null
        }
        Update: {
          cliente_id?: number | null
          created_at?: string | null
          empresa_id?: number | null
          id?: number
          percentage?: number | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          created_at: string | null
          file_urls: string[] | null
          id: number
          name: string | null
          number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          file_urls?: string[] | null
          id?: number
          name?: string | null
          number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          file_urls?: string[] | null
          id?: number
          name?: string | null
          number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      emprestimos: {
        Row: {
          conta_id: number
          created_at: string | null
          data_emprestimo: string
          id: number
          matriz_id: number
          observacoes: string | null
          socio_id: number
          tipo: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          conta_id: number
          created_at?: string | null
          data_emprestimo: string
          id?: number
          matriz_id: number
          observacoes?: string | null
          socio_id: number
          tipo: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          conta_id?: number
          created_at?: string | null
          data_emprestimo?: string
          id?: number
          matriz_id?: number
          observacoes?: string | null
          socio_id?: number
          tipo?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "emprestimos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emprestimos_matriz_id_fkey"
            columns: ["matriz_id"]
            isOneToOne: false
            referencedRelation: "matrizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emprestimos_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      estruturas_dre: {
        Row: {
          created_at: string | null
          id: number
          nome: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          nome?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          nome?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      estruturas_dre_itens: {
        Row: {
          created_at: string | null
          estrutura_dre_id: number | null
          grupo_contabil_id: number | null
          id: number
          nivel: number | null
          nome: string | null
          ordem: number | null
          parent_id: number | null
          subgrupo_contabil_id: number | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estrutura_dre_id?: number | null
          grupo_contabil_id?: number | null
          id?: number
          nivel?: number | null
          nome?: string | null
          ordem?: number | null
          parent_id?: number | null
          subgrupo_contabil_id?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estrutura_dre_id?: number | null
          grupo_contabil_id?: number | null
          id?: number
          nivel?: number | null
          nome?: string | null
          ordem?: number | null
          parent_id?: number | null
          subgrupo_contabil_id?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      estruturas_dre_soma_itens: {
        Row: {
          created_at: string | null
          id: number
          referenced_item_id: number | null
          soma_item_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          referenced_item_id?: number | null
          soma_item_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          referenced_item_id?: number | null
          soma_item_id?: number | null
        }
        Relationships: []
      }
      files: {
        Row: {
          content_type: string | null
          created_at: string | null
          entity_id: number | null
          entity_type: string | null
          file_data: string | null
          file_size: number | null
          filename: string | null
          id: number
          is_cover: boolean
          updated_at: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          entity_id?: number | null
          entity_type?: string | null
          file_data?: string | null
          file_size?: number | null
          filename?: string | null
          id?: number
          is_cover?: boolean
          updated_at?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          entity_id?: number | null
          entity_type?: string | null
          file_data?: string | null
          file_size?: number | null
          filename?: string | null
          id?: number
          is_cover?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          address: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          ein_number: string | null
          email: string | null
          id: number
          name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          ein_number?: string | null
          email?: string | null
          id?: number
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          ein_number?: string | null
          email?: string | null
          id?: number
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fornecedores_subcontratados: {
        Row: {
          contato_responsavel: string | null
          cpf_cnpj: string
          created_at: string
          email: string | null
          id: number
          nome_fantasia: string | null
          nome_razao_social: string
          observacoes: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          contato_responsavel?: string | null
          cpf_cnpj: string
          created_at?: string
          email?: string | null
          id?: number
          nome_fantasia?: string | null
          nome_razao_social: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          contato_responsavel?: string | null
          cpf_cnpj?: string
          created_at?: string
          email?: string | null
          id?: number
          nome_fantasia?: string | null
          nome_razao_social?: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      grupo_members: {
        Row: {
          cliente_id: number | null
          created_at: string | null
          empresa_id: number | null
          grupo_id: number | null
          id: number
          percentage: number | null
        }
        Insert: {
          cliente_id?: number | null
          created_at?: string | null
          empresa_id?: number | null
          grupo_id?: number | null
          id?: number
          percentage?: number | null
        }
        Update: {
          cliente_id?: number | null
          created_at?: string | null
          empresa_id?: number | null
          grupo_id?: number | null
          id?: number
          percentage?: number | null
        }
        Relationships: []
      }
      grupos: {
        Row: {
          created_at: string | null
          file_urls: string[] | null
          id: number
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          file_urls?: string[] | null
          id?: number
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          file_urls?: string[] | null
          id?: number
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      grupos_contabeis: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: number
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: number
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: number
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jornada_etapa_historico: {
        Row: {
          created_at: string
          dias_no_status: number
          id: number
          item_id: number
          jornada_id: number
          observacao: string | null
          status_anterior: string | null
          status_novo: string
          user_id: number | null
        }
        Insert: {
          created_at?: string
          dias_no_status?: number
          id?: number
          item_id: number
          jornada_id: number
          observacao?: string | null
          status_anterior?: string | null
          status_novo: string
          user_id?: number | null
        }
        Update: {
          created_at?: string
          dias_no_status?: number
          id?: number
          item_id?: number
          jornada_id?: number
          observacao?: string | null
          status_anterior?: string | null
          status_novo?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jornada_etapa_historico_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "jornada_etapa_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_etapa_historico_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_etapa_historico_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_etapa_itens: {
        Row: {
          aguardando_motivo: string | null
          checklist_concluidos: number
          checklist_total: number
          created_at: string
          data_conclusao: string | null
          data_inicio: string | null
          data_limite: string | null
          data_prevista: string | null
          dias_pausados: number
          etapa_id: number | null
          fluxo_etapa_id: number
          id: number
          jornada_id: number
          observacoes: string | null
          ordem: number
          pausado_em: string | null
          prazo_dias: number | null
          responsavel_user_id: number | null
          status: string
          status_desde: string
          updated_at: string
        }
        Insert: {
          aguardando_motivo?: string | null
          checklist_concluidos?: number
          checklist_total?: number
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          data_limite?: string | null
          data_prevista?: string | null
          dias_pausados?: number
          etapa_id?: number | null
          fluxo_etapa_id: number
          id?: number
          jornada_id: number
          observacoes?: string | null
          ordem?: number
          pausado_em?: string | null
          prazo_dias?: number | null
          responsavel_user_id?: number | null
          status?: string
          status_desde?: string
          updated_at?: string
        }
        Update: {
          aguardando_motivo?: string | null
          checklist_concluidos?: number
          checklist_total?: number
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          data_limite?: string | null
          data_prevista?: string | null
          dias_pausados?: number
          etapa_id?: number | null
          fluxo_etapa_id?: number
          id?: number
          jornada_id?: number
          observacoes?: string | null
          ordem?: number
          pausado_em?: string | null
          prazo_dias?: number | null
          responsavel_user_id?: number | null
          status?: string
          status_desde?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_etapa_itens_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "jornada_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_etapa_itens_fluxo_etapa_id_fkey"
            columns: ["fluxo_etapa_id"]
            isOneToOne: false
            referencedRelation: "jornada_fluxo_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_etapa_itens_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_etapa_itens_responsavel_user_id_fkey"
            columns: ["responsavel_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_etapas: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: number
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: number
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: number
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      jornada_fluxo_checklist: {
        Row: {
          created_at: string
          descricao: string
          fluxo_etapa_id: number
          id: number
          obrigatorio: boolean
          ordem: number
        }
        Insert: {
          created_at?: string
          descricao: string
          fluxo_etapa_id: number
          id?: number
          obrigatorio?: boolean
          ordem?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          fluxo_etapa_id?: number
          id?: number
          obrigatorio?: boolean
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "jornada_fluxo_checklist_fluxo_etapa_id_fkey"
            columns: ["fluxo_etapa_id"]
            isOneToOne: false
            referencedRelation: "jornada_fluxo_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_fluxo_etapas: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          fluxo_id: number
          id: number
          legacy_etapa_id: number | null
          nome: string
          ordem: number
          prazo_dias: number | null
          responsavel_padrao_user_id: number | null
          setor: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          fluxo_id: number
          id?: number
          legacy_etapa_id?: number | null
          nome: string
          ordem?: number
          prazo_dias?: number | null
          responsavel_padrao_user_id?: number | null
          setor?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          fluxo_id?: number
          id?: number
          legacy_etapa_id?: number | null
          nome?: string
          ordem?: number
          prazo_dias?: number | null
          responsavel_padrao_user_id?: number | null
          setor?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_fluxo_etapas_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "jornada_fluxos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_fluxo_etapas_responsavel_padrao_user_id_fkey"
            columns: ["responsavel_padrao_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_fluxos: {
        Row: {
          ativo: boolean
          avanco_automatico: boolean
          created_at: string
          descricao: string | null
          entity_type: string | null
          id: number
          nome: string
          padrao: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          avanco_automatico?: boolean
          created_at?: string
          descricao?: string | null
          entity_type?: string | null
          id?: number
          nome: string
          padrao?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          avanco_automatico?: boolean
          created_at?: string
          descricao?: string | null
          entity_type?: string | null
          id?: number
          nome?: string
          padrao?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      jornada_item_checklist: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          concluido_por_user_id: number | null
          created_at: string
          descricao: string
          fluxo_checklist_id: number | null
          id: number
          item_id: number
          obrigatorio: boolean
          ordem: number
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por_user_id?: number | null
          created_at?: string
          descricao: string
          fluxo_checklist_id?: number | null
          id?: number
          item_id: number
          obrigatorio?: boolean
          ordem?: number
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por_user_id?: number | null
          created_at?: string
          descricao?: string
          fluxo_checklist_id?: number | null
          id?: number
          item_id?: number
          obrigatorio?: boolean
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "jornada_item_checklist_concluido_por_user_id_fkey"
            columns: ["concluido_por_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_item_checklist_fluxo_checklist_id_fkey"
            columns: ["fluxo_checklist_id"]
            isOneToOne: false
            referencedRelation: "jornada_fluxo_checklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_item_checklist_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "jornada_etapa_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      jornadas: {
        Row: {
          created_at: string
          created_by_user_id: number | null
          data_conclusao: string | null
          data_inicio: string
          entity_id: number
          entity_type: string
          etapa_atual_id: number | null
          etapa_atual_item_id: number | null
          etapas_concluidas: number
          fluxo_id: number | null
          id: number
          observacoes: string | null
          progresso: number
          responsavel_user_id: number | null
          status: string
          total_etapas: number
          updated_at: string
          updated_by_user_id: number | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: number | null
          data_conclusao?: string | null
          data_inicio?: string
          entity_id: number
          entity_type: string
          etapa_atual_id?: number | null
          etapa_atual_item_id?: number | null
          etapas_concluidas?: number
          fluxo_id?: number | null
          id?: number
          observacoes?: string | null
          progresso?: number
          responsavel_user_id?: number | null
          status?: string
          total_etapas?: number
          updated_at?: string
          updated_by_user_id?: number | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: number | null
          data_conclusao?: string | null
          data_inicio?: string
          entity_id?: number
          entity_type?: string
          etapa_atual_id?: number | null
          etapa_atual_item_id?: number | null
          etapas_concluidas?: number
          fluxo_id?: number | null
          id?: number
          observacoes?: string | null
          progresso?: number
          responsavel_user_id?: number | null
          status?: string
          total_etapas?: number
          updated_at?: string
          updated_by_user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jornadas_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_etapa_atual_id_fkey"
            columns: ["etapa_atual_id"]
            isOneToOne: false
            referencedRelation: "jornada_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "jornada_fluxos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_responsavel_user_id_fkey"
            columns: ["responsavel_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          color: string | null
          created_at: string | null
          id: number
          name: string | null
          position: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: number
          name?: string | null
          position?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: number
          name?: string | null
          position?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      matriz_socios: {
        Row: {
          created_at: string | null
          id: number
          matriz_id: number | null
          percentual_participacao: number | null
          socio_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          matriz_id?: number | null
          percentual_participacao?: number | null
          socio_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          matriz_id?: number | null
          percentual_participacao?: number | null
          socio_id?: number | null
        }
        Relationships: []
      }
      matrizes: {
        Row: {
          cnpj_ein: string | null
          created_at: string | null
          endereco: string | null
          id: number
          nome: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj_ein?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: number
          nome?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj_ein?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: number
          nome?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      obrigacoes_catalogo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          dia_vencimento: number
          id: number
          mes_ancora: number | null
          mes_offset: number
          nome: string
          periodicidade: string
          prazo_interno_dias: number
          setor: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          dia_vencimento?: number
          id?: number
          mes_ancora?: number | null
          mes_offset?: number
          nome: string
          periodicidade?: string
          prazo_interno_dias?: number
          setor?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          dia_vencimento?: number
          id?: number
          mes_ancora?: number | null
          mes_offset?: number
          nome?: string
          periodicidade?: string
          prazo_interno_dias?: number
          setor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      obrigacoes_cliente: {
        Row: {
          ativo: boolean
          created_at: string
          created_by_user_id: number | null
          data_fim: string | null
          data_inicio: string
          entity_id: number
          entity_type: string
          id: number
          obrigacao_id: number
          observacoes: string | null
          responsavel_user_id: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by_user_id?: number | null
          data_fim?: string | null
          data_inicio?: string
          entity_id: number
          entity_type: string
          id?: number
          obrigacao_id: number
          observacoes?: string | null
          responsavel_user_id?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by_user_id?: number | null
          data_fim?: string | null
          data_inicio?: string
          entity_id?: number
          entity_type?: string
          id?: number
          obrigacao_id?: number
          observacoes?: string | null
          responsavel_user_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obrigacoes_cliente_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obrigacoes_cliente_obrigacao_id_fkey"
            columns: ["obrigacao_id"]
            isOneToOne: false
            referencedRelation: "obrigacoes_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obrigacoes_cliente_responsavel_user_id_fkey"
            columns: ["responsavel_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      obrigacoes_competencias: {
        Row: {
          aguardando_motivo: string | null
          competencia_ano: number
          competencia_label: string
          competencia_mes: number
          created_at: string
          data_entrega: string | null
          data_limite_interna: string
          data_vencimento: string
          dias_pausados: number
          id: number
          obrigacao_cliente_id: number
          observacoes: string | null
          pausado_em: string | null
          protocolo: string | null
          responsavel_user_id: number | null
          status: string
          status_desde: string
          updated_at: string
        }
        Insert: {
          aguardando_motivo?: string | null
          competencia_ano: number
          competencia_label: string
          competencia_mes: number
          created_at?: string
          data_entrega?: string | null
          data_limite_interna: string
          data_vencimento: string
          dias_pausados?: number
          id?: number
          obrigacao_cliente_id: number
          observacoes?: string | null
          pausado_em?: string | null
          protocolo?: string | null
          responsavel_user_id?: number | null
          status?: string
          status_desde?: string
          updated_at?: string
        }
        Update: {
          aguardando_motivo?: string | null
          competencia_ano?: number
          competencia_label?: string
          competencia_mes?: number
          created_at?: string
          data_entrega?: string | null
          data_limite_interna?: string
          data_vencimento?: string
          dias_pausados?: number
          id?: number
          obrigacao_cliente_id?: number
          observacoes?: string | null
          pausado_em?: string | null
          protocolo?: string | null
          responsavel_user_id?: number | null
          status?: string
          status_desde?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obrigacoes_competencias_obrigacao_cliente_id_fkey"
            columns: ["obrigacao_cliente_id"]
            isOneToOne: false
            referencedRelation: "obrigacoes_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obrigacoes_competencias_responsavel_user_id_fkey"
            columns: ["responsavel_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          created_at: string | null
          description: string
          fornecedor_id: number | null
          id: number
          predicted_date: string | null
          projeto_id: number | null
          updated_at: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          description: string
          fornecedor_id?: number | null
          id?: number
          predicted_date?: string | null
          projeto_id?: number | null
          updated_at?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          description?: string
          fornecedor_id?: number | null
          id?: number
          predicted_date?: string | null
          projeto_id?: number | null
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros: {
        Row: {
          chave: string | null
          created_at: string | null
          descricao: string | null
          id: number
          tipo: string | null
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          chave?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: number
          tipo?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: number
          tipo?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      periodos_bloqueados: {
        Row: {
          aplica_todas_matrizes: boolean
          bloqueia_competencia: boolean
          bloqueia_pagamento: boolean
          created_at: string
          created_by: string | null
          id: number
          referencia_mes: string
          status: string
          updated_at: string
        }
        Insert: {
          aplica_todas_matrizes?: boolean
          bloqueia_competencia?: boolean
          bloqueia_pagamento?: boolean
          created_at?: string
          created_by?: string | null
          id?: number
          referencia_mes: string
          status?: string
          updated_at?: string
        }
        Update: {
          aplica_todas_matrizes?: boolean
          bloqueia_competencia?: boolean
          bloqueia_pagamento?: boolean
          created_at?: string
          created_by?: string | null
          id?: number
          referencia_mes?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      periodos_bloqueados_matrizes: {
        Row: {
          id: number
          matriz_id: number
          periodo_bloqueado_id: number
        }
        Insert: {
          id?: number
          matriz_id: number
          periodo_bloqueado_id: number
        }
        Update: {
          id?: number
          matriz_id?: number
          periodo_bloqueado_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "periodos_bloqueados_matrizes_matriz_id_fkey"
            columns: ["matriz_id"]
            isOneToOne: false
            referencedRelation: "matrizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_bloqueados_matrizes_periodo_bloqueado_id_fkey"
            columns: ["periodo_bloqueado_id"]
            isOneToOne: false
            referencedRelation: "periodos_bloqueados"
            referencedColumns: ["id"]
          },
        ]
      }
      previsao_aportes: {
        Row: {
          created_at: string | null
          data_previsao: string
          id: number
          membro_id: number
          observacoes: string | null
          projeto_id: number
          updated_at: string | null
          valor_previsto: number
        }
        Insert: {
          created_at?: string | null
          data_previsao: string
          id?: number
          membro_id: number
          observacoes?: string | null
          projeto_id: number
          updated_at?: string | null
          valor_previsto: number
        }
        Update: {
          created_at?: string | null
          data_previsao?: string
          id?: number
          membro_id?: number
          observacoes?: string | null
          projeto_id?: number
          updated_at?: string | null
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "previsao_aportes_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "projeto_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "previsao_aportes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          codigo: string | null
          created_at: string | null
          descricao: string | null
          grupo_id: number | null
          id: number
          subgrupo_id: number | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          grupo_id?: number | null
          id?: number
          subgrupo_id?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          grupo_id?: number | null
          id?: number
          subgrupo_id?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          legacy_user_id: number | null
          name: string | null
          phone: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          legacy_user_id?: number | null
          name?: string | null
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          legacy_user_id?: number | null
          name?: string | null
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      projeto_column_history: {
        Row: {
          from_column_id: number | null
          id: number
          moved_at: string | null
          projeto_id: number
          to_column_id: number
          user_id: number
        }
        Insert: {
          from_column_id?: number | null
          id?: number
          moved_at?: string | null
          projeto_id: number
          to_column_id: number
          user_id: number
        }
        Update: {
          from_column_id?: number | null
          id?: number
          moved_at?: string | null
          projeto_id?: number
          to_column_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "projeto_column_history_from_column_id_fkey"
            columns: ["from_column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_column_history_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_column_history_to_column_id_fkey"
            columns: ["to_column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_column_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: number
          projeto_id: number
          user_id: number
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: number
          projeto_id: number
          user_id: number
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: number
          projeto_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "projeto_comments_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_members: {
        Row: {
          cliente_id: number | null
          created_at: string | null
          empresa_id: number | null
          grupo_id: number | null
          id: number
          percentage: number | null
          projeto_id: number | null
        }
        Insert: {
          cliente_id?: number | null
          created_at?: string | null
          empresa_id?: number | null
          grupo_id?: number | null
          id?: number
          percentage?: number | null
          projeto_id?: number | null
        }
        Update: {
          cliente_id?: number | null
          created_at?: string | null
          empresa_id?: number | null
          grupo_id?: number | null
          id?: number
          percentage?: number | null
          projeto_id?: number | null
        }
        Relationships: []
      }
      projeto_tasks: {
        Row: {
          completed_at: string | null
          completed_by: number | null
          created_at: string | null
          created_by: number
          id: number
          is_completed: boolean | null
          projeto_id: number
          task_name: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: number | null
          created_at?: string | null
          created_by: number
          id?: number
          is_completed?: boolean | null
          projeto_id: number
          task_name: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: number | null
          created_at?: string | null
          created_by?: number
          id?: number
          is_completed?: boolean | null
          projeto_id?: number
          task_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tasks_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          address: string | null
          city: string | null
          construction_sqft: number | null
          created_at: string | null
          details: string | null
          document_urls: string[] | null
          id: number
          kanban_column_id: number | null
          kanban_position: number | null
          land_sqft: number | null
          name: string | null
          photo_urls: string[] | null
          predicted_sale_value: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          construction_sqft?: number | null
          created_at?: string | null
          details?: string | null
          document_urls?: string[] | null
          id?: number
          kanban_column_id?: number | null
          kanban_position?: number | null
          land_sqft?: number | null
          name?: string | null
          photo_urls?: string[] | null
          predicted_sale_value?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          construction_sqft?: number | null
          created_at?: string | null
          details?: string | null
          document_urls?: string[] | null
          id?: number
          kanban_column_id?: number | null
          kanban_position?: number | null
          land_sqft?: number | null
          name?: string | null
          photo_urls?: string[] | null
          predicted_sale_value?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rateio_aportes: {
        Row: {
          aporte_id: number
          conta_receber_id: number
          created_at: string | null
          id: number
          updated_at: string | null
          valor_rateado: number
        }
        Insert: {
          aporte_id: number
          conta_receber_id: number
          created_at?: string | null
          id?: number
          updated_at?: string | null
          valor_rateado?: number
        }
        Update: {
          aporte_id?: number
          conta_receber_id?: number
          created_at?: string | null
          id?: number
          updated_at?: string | null
          valor_rateado?: number
        }
        Relationships: [
          {
            foreignKeyName: "rateio_aportes_aporte_id_fkey"
            columns: ["aporte_id"]
            isOneToOne: false
            referencedRelation: "previsao_aportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_aportes_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
        ]
      }
      retiradas: {
        Row: {
          conta_id: number | null
          created_at: string | null
          data_retirada: string | null
          id: number
          matriz_id: number | null
          observacoes: string | null
          socio_id: number | null
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          conta_id?: number | null
          created_at?: string | null
          data_retirada?: string | null
          id?: number
          matriz_id?: number | null
          observacoes?: string | null
          socio_id?: number | null
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          conta_id?: number | null
          created_at?: string | null
          data_retirada?: string | null
          id?: number
          matriz_id?: number | null
          observacoes?: string | null
          socio_id?: number | null
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      socios: {
        Row: {
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          id: number
          nome: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: number
          nome?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: number
          nome?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subgrupos_contabeis: {
        Row: {
          created_at: string | null
          descricao: string | null
          funcao: string | null
          grupo_id: number | null
          id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          funcao?: string | null
          grupo_id?: number | null
          id?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          funcao?: string | null
          grupo_id?: number | null
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      tipos_documento: {
        Row: {
          codigo: string | null
          created_at: string | null
          descricao: string | null
          id: number
          mascara: string | null
          updated_at: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: number
          mascara?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: number
          mascara?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      titulos_pagar: {
        Row: {
          conta_id: number | null
          conta_pagar_id: number | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          id: number
          observacoes_pagamento: string | null
          parcela: number | null
          status: string | null
          total_parcelas: number | null
          updated_at: string | null
          valor: number | null
          valor_pago: number | null
        }
        Insert: {
          conta_id?: number | null
          conta_pagar_id?: number | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          id?: number
          observacoes_pagamento?: string | null
          parcela?: number | null
          status?: string | null
          total_parcelas?: number | null
          updated_at?: string | null
          valor?: number | null
          valor_pago?: number | null
        }
        Update: {
          conta_id?: number | null
          conta_pagar_id?: number | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          id?: number
          observacoes_pagamento?: string | null
          parcela?: number | null
          status?: string | null
          total_parcelas?: number | null
          updated_at?: string | null
          valor?: number | null
          valor_pago?: number | null
        }
        Relationships: []
      }
      titulos_receber: {
        Row: {
          conta_id: number | null
          conta_receber_id: number | null
          created_at: string | null
          data_recebimento: string | null
          data_vencimento: string | null
          id: number
          observacoes_recebimento: string | null
          parcela: number | null
          status: string | null
          total_parcelas: number | null
          updated_at: string | null
          valor: number | null
          valor_recebido: number | null
        }
        Insert: {
          conta_id?: number | null
          conta_receber_id?: number | null
          created_at?: string | null
          data_recebimento?: string | null
          data_vencimento?: string | null
          id?: number
          observacoes_recebimento?: string | null
          parcela?: number | null
          status?: string | null
          total_parcelas?: number | null
          updated_at?: string | null
          valor?: number | null
          valor_recebido?: number | null
        }
        Update: {
          conta_id?: number | null
          conta_receber_id?: number | null
          created_at?: string | null
          data_recebimento?: string | null
          data_vencimento?: string | null
          id?: number
          observacoes_recebimento?: string | null
          parcela?: number | null
          status?: string | null
          total_parcelas?: number | null
          updated_at?: string | null
          valor?: number | null
          valor_recebido?: number | null
        }
        Relationships: []
      }
      transferencias: {
        Row: {
          conta_destino_id: number | null
          conta_origem_id: number | null
          created_at: string | null
          data_transferencia: string | null
          id: number
          observacoes: string | null
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          conta_destino_id?: number | null
          conta_origem_id?: number | null
          created_at?: string | null
          data_transferencia?: string | null
          id?: number
          observacoes?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          conta_destino_id?: number | null
          conta_origem_id?: number | null
          created_at?: string | null
          data_transferencia?: string | null
          id?: number
          observacoes?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          id: number
          last_login: string | null
          name: string | null
          password_hash: string | null
          password_reset_expires: string | null
          password_reset_token: string | null
          phone: string | null
          role: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: number
          last_login?: string | null
          name?: string | null
          password_hash?: string | null
          password_reset_expires?: string | null
          password_reset_token?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: number
          last_login?: string | null
          name?: string | null
          password_hash?: string | null
          password_reset_expires?: string | null
          password_reset_token?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      orcamentos_executado: {
        Row: {
          description: string | null
          fornecedor_id: number | null
          id: number | null
          predicted_date: string | null
          projeto_id: number | null
          valor_executado: number | null
          valor_orcado: number | null
          valor_saldo: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_operacao_entidades: {
        Row: {
          entity_id: number | null
          entity_name: string | null
          entity_type: string | null
        }
        Relationships: []
      }
      vw_operacao_tarefas: {
        Row: {
          aguardando: boolean | null
          aguardando_motivo: string | null
          checklist_concluidos: number | null
          checklist_total: number | null
          cliente_nome: string | null
          contexto: string | null
          data_limite: string | null
          data_vencimento_legal: string | null
          dias_atraso: number | null
          dias_no_status: number | null
          dias_parados: number | null
          entity_id: number | null
          entity_type: string | null
          jornada_id: number | null
          origem: string | null
          referencia_id: number | null
          responsavel_nome: string | null
          responsavel_user_id: number | null
          setor: string | null
          status: string | null
          titulo: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_auditoria_fornecedor: {
        Args: { p_auditoria_id: number }
        Returns: undefined
      }
      delete_jornada: { Args: { p_jornada_id: number }; Returns: Json }
      delete_jornada_etapa: { Args: { p_etapa_id: number }; Returns: Json }
      delete_jornada_fluxo: { Args: { p_fluxo_id: number }; Returns: Json }
      delete_jornada_item_checklist: {
        Args: { p_checklist_id: number }
        Returns: Json
      }
      delete_obrigacao_catalogo: {
        Args: { p_obrigacao_id: number }
        Returns: Json
      }
      delete_obrigacao_cliente: { Args: { p_id: number }; Returns: Json }
      gerar_obrigacoes_competencias: {
        Args: {
          p_meses_futuro?: number
          p_meses_passado?: number
          p_obrigacao_cliente_id?: number
        }
        Returns: Json
      }
      obrigacao_competencia_label: {
        Args: { p_ano: number; p_mes: number; p_periodicidade: string }
        Returns: string
      }
      obrigacao_data_vencimento: {
        Args: { p_ano: number; p_dia: number; p_mes: number; p_offset: number }
        Returns: string
      }
      recalc_auditoria_fornecedor: {
        Args: { p_auditoria_id: number }
        Returns: undefined
      }
      recalc_auditoria_fornecedor_item: {
        Args: { p_item_id: number }
        Returns: undefined
      }
      recalc_jornada: { Args: { p_jornada_id: number }; Returns: undefined }
      save_auditoria_fornecedor: {
        Args: { p_payload: Json; p_user_id?: number }
        Returns: Json
      }
      save_jornada: {
        Args: { p_payload: Json; p_user_id?: number }
        Returns: Json
      }
      save_jornada_etapa: { Args: { p_payload: Json }; Returns: Json }
      save_jornada_fluxo: { Args: { p_payload: Json }; Returns: Json }
      save_jornada_item: {
        Args: { p_payload: Json; p_user_id?: number }
        Returns: Json
      }
      save_jornada_item_checklist: { Args: { p_payload: Json }; Returns: Json }
      save_obrigacao_catalogo: { Args: { p_payload: Json }; Returns: Json }
      save_obrigacao_cliente: {
        Args: { p_payload: Json; p_user_id?: number }
        Returns: Json
      }
      save_obrigacao_competencia: {
        Args: { p_payload: Json; p_user_id?: number }
        Returns: Json
      }
      sincronizar_jornada_etapas: {
        Args: { p_jornada_id: number }
        Returns: Json
      }
      sync_auditoria_fornecedor_parcelas_total: {
        Args: { p_item_id: number }
        Returns: undefined
      }
      toggle_jornada_item_checklist: {
        Args: {
          p_checklist_id: number
          p_concluido: boolean
          p_user_id?: number
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
