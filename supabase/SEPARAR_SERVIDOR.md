# Como migrar o MyRose para um servidor dedicado no futuro

O MyRose usa tabelas isoladas com prefixo **`mr_`** no schema `public` (sem chaves estrangeiras apontando para tabelas externas ou `auth.users`), Storage próprio (`mr-mappings`, `mr-catalogo`) e Edge Functions com prefixo **`mr-`**.

## Regras enquanto estiver compartilhado
1. Nunca execute `supabase db reset` em bancos compartilhados — aplique apenas migrations novas com prefixo `myrose_*` / `mr_*`.
2. Todas as variáveis opcionais específicas do MyRose aceitam prefixo `MR_` (`MR_SUPABASE_URL`, `MR_SERVICE_ROLE_KEY`, `MR_STRIPE_SECRET_KEY`, `MR_STRIPE_WEBHOOK_SECRET`, `MR_STRIPE_PORTAL_CONFIG_ID`).

## Passo a passo para separar o banco
1. Provisione um novo projeto PostgreSQL / Supabase.
2. Exporte somente as tabelas do MyRose:
   ```bash
   pg_dump "$OLD_DATABASE_URL" --table='public.mr_*' --no-owner --no-privileges -f myrose_backup.sql
   ```
3. Restaure no novo servidor (`psql "$NEW_DATABASE_URL" -f myrose_backup.sql`) + recrie os buckets `mr-mappings` (privado) e `mr-catalogo` (público).
4. Faça o deploy das Edge Functions em `supabase/functions/mr-*` no novo projeto e atualize `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no frontend.
5. Caso o provedor de Auth mude, sincronize `public.mr_studios.auth_user_id` por e-mail.
