# Subir a `salvar_modelagem` — teste diferencial e ordem de publicação

Dois roteiros manuais. O primeiro prova que a função grava o mesmo que o caminho
antigo; o segundo põe as duas pontas no ar sem tirar o salvamento do ar.

**Leia o §2 antes de publicar qualquer coisa.** A ordem errada não deixa o
salvamento lento — para de funcionar, em todas as modelagens.

---

## 1 · Teste diferencial (`pg_dump --data-only`)

O guard de colunas (`migrations/colunas-funcoes.test.ts`) prova que a função
**cita** toda coluna. Não prova que grava o mesmo **valor**. Só o diferencial
prova.

### Por que é manual

Precisa de dois Postgres e de uma modelagem de verdade. Não vira CI — e um
teste que não roda não guarda nada, então é melhor que seja um passo escrito do
que uma intenção.

### Preparo

```bash
# Dois bancos vazios do mesmo Postgres 16.
createdb dif_antigo
createdb dif_novo

# As migrations do módulo, NA ORDEM NUMÉRICA, nos dois. A ordem importa:
# 1764700000 depende de tudo que veio antes.
for db in dif_antigo dif_novo; do
  for f in $(ls migrations/17*.sql migrations/176*.sql | sort -u); do
    psql -q -d "$db" -f "$f" || { echo "FALHOU: $f em $db"; break; }
  done
done
```

> A `1764700000` chama `auth.jwt()`, que não existe fora do Supabase. Para o
> teste local, crie o stub **antes** de aplicá-la:
>
> ```sql
> CREATE SCHEMA IF NOT EXISTS auth;
> CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
>   LANGUAGE sql STABLE AS $$ SELECT '{"app_metadata":{"status":"aprovado"}}'::jsonb $$;
> ```
>
> Sem ele o gate levanta `42501` e nada é gravado. **Não** aplique este stub em
> produção.

### Estado inicial

Semeie **a mesma** modelagem de locação nos dois bancos, com pelo menos uma
linha em cada uma das 18 tabelas. O jeito mais barato é um `pg_dump --data-only`
de uma modelagem real de produção, restaurado nos dois.

Confira que partiram iguais antes de mexer em qualquer coisa:

```bash
./scripts/dump-modelagem.sh dif_antigo > /tmp/base_antigo.sql
./scripts/dump-modelagem.sh dif_novo   > /tmp/base_novo.sql
diff /tmp/base_antigo.sql /tmp/base_novo.sql && echo "PARTIRAM IGUAIS"
```

### O dump, normalizado

`created_at` e `updated_at` diferem sempre e por desenho. Sem tirá-los o diff é
ruído puro e ninguém o roda duas vezes.

```bash
#!/usr/bin/env bash
# scripts/dump-modelagem.sh <banco>
set -euo pipefail
db="$1"
tabelas=$(psql -Atc "SELECT string_agg('-t '||tablename,' ' ORDER BY tablename)
                       FROM pg_tables
                      WHERE schemaname='public' AND tablename LIKE 'modelagem%'" "$db")
pg_dump "$db" --data-only --no-owner --column-inserts $tabelas \
  | grep '^INSERT' \
  | sed -E "s/, '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9:.]+'//g" \
  | sort
```

### Cenário A — locação cheia, primeiro salvamento

Exercita todo INSERT. Pelo caminho **antigo**, use o editor no commit anterior
ao `alt 25` apontando para `dif_antigo`; pelo **novo**, o commit atual apontando
para `dif_novo`. O payload tem de ser byte a byte o mesmo — colha-o do
`console.log` do `montarPayload` uma vez e reaproveite nos dois.

### Cenário B — um campo alterado

Exercita todo UPDATE, nenhum INSERT. A partir do estado final do cenário A,
mude só `premissas.nome` e salve.

### Cenário C — o que os dois anteriores não cobrem

Um salvamento que mexe nos ramos de DELETE e nas armadilhas de NULL:

- remove uma tipologia e cria outra;
- regenera as parcelas de um custo (todas sem `id`);
- zera uma alocação;
- tira um mês da curva de benchmark e outro da ocupação;
- devolve `mes_inicio_opex` e `pct_capital` a `null`;
- acrescenta uma facilidade nova com taxa, prazo e LTC preenchidos.

### Comparar

```bash
diff /tmp/antigo.sql /tmp/novo.sql
```

**A única diferença aceitável é o valor dos `id` das linhas recriadas — e das
FKs que apontam para elas.** Qualquer outra é bug.

### Duas divergências são ESPERADAS e não são bug

O cenário C as expõe de propósito; se elas **não** aparecerem, o teste está
errado:

1. **Facilidade nova.** O caminho antigo grava `taxa=0, prazo=NULL, ltc=NULL,
   valor_contratado=NULL` — o `sincronizar()` manda quem não tem `id` para o
   `criarFacilidade`, que grava seis colunas. O novo grava as 30. O antigo é
   que está errado: `AbaFinanciamento.tsx:715` faz a facilidade nova herdar os
   campos de contrato da primeira, então o usuário vê uma facilidade
   configurada, salva, e ela volta nos DEFAULT.
2. **`AND modelagem_id = v_id`.** Só aparece se o payload carregar um `id`
   forjado — o que o cenário C não faz. Não deve produzir diferença nenhuma.

### O que preciso de você

- Um `pg_dump` de uma modelagem de locação cheia de produção, sem dado
  sensível, para servir de estado inicial.
- Confirmação de qual commit é o "caminho antigo" — provavelmente `4899113`.
- Os dois bancos, ou acesso a uma máquina que os tenha. Aqui não há Postgres.

---

## 2 · Ordem de publicação

### O que foi apurado sobre este repositório

| | |
|---|---|
| CI / GitHub Actions | **não existe** — não há `.github/`, nem workflow nenhum |
| Script que aplica migrations | **não existe** em `scripts/` nem no `package.json` |
| `migrations/applied.txt` | **abandonado** — última linha é `1758100000`, de 2025-09-29. As ~35 migrations seguintes, incluindo todo o módulo de modelagem, não estão registradas |
| `supabase/migrations/` | convenção do Supabase CLI (`20260827120611_<uuid>.sql`). É o que `supabase db push` aplica |
| `migrations/` (raiz) | numeração própria (`1764700000_*.sql`). **O Supabase CLI não lê esta pasta** |

**Conclusão: a `1764700000` não sobe sozinha.** Ela está na pasta raiz, que
nenhuma ferramenta deste repositório aplica. Foi assim com a `duplicar_modelagem`
e com as outras 34 — todas aplicadas à mão.

### Duas perguntas que só você pode responder

1. **Como as migrations de `migrations/` foram aplicadas até hoje?** O caminho
   provável é colar o SQL no editor do painel do Supabase. Se for outro, o
   passo 1 abaixo muda.
2. **Publicar no Lovable dispara deploy ao commitar, ou só no botão Publicar?**
   Não dá para saber pelo repositório. **Confirme antes do passo 3** — é a
   diferença entre uma janela controlada e o front subindo sozinho.

Se a resposta a (2) for "sobe sozinho ao commitar no main", então **o front já
está no ar desde o commit `alt 25`** e o salvamento já está quebrado. Nesse caso
o passo 1 é urgente, não preparatório.

### A sequência segura

A migration vai **sempre** primeiro. Ela é `CREATE OR REPLACE FUNCTION` mais
`GRANT`: cria um objeto que ninguém ainda chama. Para o front antigo é inerte —
não há risco em aplicá-la cedo, e há risco em aplicá-la tarde.

---

**Passo 1 — aplicar a migration.**

Cole `migrations/1764700000_fn_salvar_modelagem.sql` inteiro no SQL Editor do
projeto `zkzcdafgdcsotcnmlmcp` e execute.

*Confirmar antes de seguir:*

```sql
SELECT p.proname, p.prosecdef AS security_definer, p.proconfig
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'salvar_modelagem';
```

Tem de devolver uma linha, com `security_definer = true` e
`proconfig = {search_path=public}`. Zero linha = não aplicou.

---

**Passo 2 — conferir o GRANT e recarregar o cache do PostgREST.**

```sql
SELECT grantee, privilege_type
  FROM information_schema.routine_privileges
 WHERE routine_name = 'salvar_modelagem';
```

Tem de aparecer `authenticated / EXECUTE`, e **não** pode aparecer `anon` nem
`PUBLIC`.

O PostgREST mantém um cache de esquema e só enxerga a função depois de
recarregá-lo. O Supabase costuma fazer isso sozinho, mas com atraso — force:

```sql
NOTIFY pgrst, 'reload schema';
```

*Esta é a causa mais provável de "apliquei a migration e mesmo assim deu 404".*

---

**Passo 3 — só então publicar o front.**

Se o Lovable publica no botão, é agora. Se publica sozinho ao commitar, o passo
3 já aconteceu e você está confirmando, não executando.

*Confirmar:* abra uma modelagem, salve, e veja no DevTools → Network uma
requisição `POST /rest/v1/rpc/salvar_modelagem` com status **200**. Duas
requisições no total: essa e o `loadModelagemCompleta` do `recarregar()`.

---

**Passo 4 — conferir com a flag ligada.**

```js
localStorage.setItem('provison:debug:salvar', '1')
```

Recarregue, salve, e leia o console. O esperado é `TOTAL 2 req` no lugar de
`118 req`, com o tempo caindo de ~122 s para poucos segundos.

---

### Se o front subir antes da migration

**Sintoma exato.** O PostgREST devolve **HTTP 404** com código `PGRST202` e a
mensagem `Could not find the function public.salvar_modelagem(p_payload) in the
schema cache`. O `actions/salvarModelagem.ts` faz `throw new Error(error.message)`,
o `catch` do `salvar()` pega, e a tela mostra o toast **"Erro ao salvar"** com
esse texto.

**O que NÃO acontece:** nada é gravado pela metade. A chamada falha antes de
tocar no banco, e o `recarregar()` nem roda. O rascunho da tela continua
intacto — o usuário não perde o que digitou, só não consegue salvar.

**Volta atrás — o caminho rápido é para a frente.** Aplique a migration (passo
1) e mande `NOTIFY pgrst, 'reload schema'`. São dois minutos e resolve para
todo mundo ao mesmo tempo, sem redeploy.

Reverter o front é o caminho lento e pior: `git revert b21ded5` desfaz também a
instrumentação do `execute-sql` e o `payloadSalvar.ts`, e ainda exige um novo
deploy. Só faça isso se a migration não puder ser aplicada por algum motivo.

---

## 3 · Anotado, não implementado

Aberto de propósito, para não entrar sem o diferencial saber que precisa cobrir:

- **`v_fac` aceita id forjado.** No bloco 10, quando a facilidade tem `id`, a
  função faz `v_novo := (r.e ->> 'id')::int` e só depois filtra o UPDATE por
  `modelagem_id = v_id`. Se o UPDATE não casar, `v_novo` **continua com o id
  forjado** e vai para `v_fac` — e o bloco 12 grava a curva de benchmark
  apontando para uma facilidade de outra modelagem, com FK válida. É o único
  ponto onde o `AND modelagem_id = v_id` não fecha. Os demais mapas
  (`v_un`, `v_cu`, `v_so`, `v_fa`) vêm de `RETURNING` e ficam `NULL`.
- **`CONTINUE WHEN v_novo IS NULL` no bloco 12** (curva de benchmark) — quarto
  descarte silencioso, não listado no item 7. Hoje é inalcançável, porque
  `v_fac` nunca fica nulo (ver acima). Se o item anterior for corrigido, este
  passa a ser alcançável e vira exceção junto.
- **`createModelagemFacilidade.ts` virou código morto** — nenhum componente o
  importa desde o `alt 25`.
