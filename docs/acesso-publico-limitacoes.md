# Limitações de Acesso Público - UI Bakery Business Trial

## Problema Identificado
**Erro:** `User "Anonymous" denied "request" access to "Datasource"`

Este erro ocorre quando usuários não autenticados tentam acessar a aplicação de computadores externos.

## Limitações do Plano Trial

### Business Trial
- ❌ Acesso público limitado aos datasources
- ❌ Usuários anônimos não podem executar actions
- ⚠️ Aplicação só funciona para usuários autenticados na plataforma UI Bakery

### Planos Pagos
- ✅ Acesso público irrestrito
- ✅ Compartilhamento público de aplicações
- ✅ Usuários externos podem acessar sem login na plataforma

## Soluções Disponíveis

### 1. Upgrade para Plano Pago
- Permite acesso público completo
- Remove limitações de datasource
- Habilita compartilhamento externo

### 2. Autenticação na Plataforma
- Usuários precisam ter conta no UI Bakery
- Precisam estar logados na plataforma
- Apenas para desenvolvimento/testes

### 3. Alternativa Temporária (Desenvolvimento)
- Usar HTTP actions com APIs públicas
- Implementar autenticação própria via JWT
- Migrar dados para serviço externo temporariamente

## Como Verificar o Status

1. Acesse a URL com `?status=true`
2. Teste conectividade básica
3. Verifique logs de acesso

## Recomendação

Para produção com acesso externo, é necessário upgrade para plano pago do UI Bakery.
