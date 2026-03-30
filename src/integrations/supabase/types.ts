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
    PostgrestVersion: "14.4"
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
    }
    Functions: {
      delete_auditoria_fornecedor: {
        Args: { p_auditoria_id: number }
        Returns: undefined
      }
      recalc_auditoria_fornecedor: {
        Args: { p_auditoria_id: number }
        Returns: undefined
      }
      recalc_auditoria_fornecedor_item: {
        Args: { p_item_id: number }
        Returns: undefined
      }
      save_auditoria_fornecedor: {
        Args: { p_payload: Json; p_user_id?: number }
        Returns: Json
      }
      sync_auditoria_fornecedor_parcelas_total: {
        Args: { p_item_id: number }
        Returns: undefined
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
