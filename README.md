# MyRose — Gestão para Estúdios de Cílios e Estética

Aplicação web/PWA para estúdios de lash & estética: agenda com cálculo de horários livres, portal público de agendamento (`/agendar/:codigo`), ficha de anamnese por link (`/ficha/:token`), Lash Mapping em canvas PNG com URLs assinadas, financeiro com controle de estoque, modelos WhatsApp e assinaturas via Stripe.

## Stack
- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS v4, React Router (code-splitting por rota), Lucide Icons
- **Backend / BaaS:** Supabase (Auth, PostgreSQL com RLS multi-tenant, Storage privado `mr-mappings`, Edge Functions em Deno)
- **Pagamentos SaaS:** Stripe Checkout, Billing Portal e Webhooks com verificação criptográfica + idempotência
- **Testes:** Vitest

## Rodando localmente

1. Instale as dependências e rode em **Modo Preview Local** (sem precisar de Supabase — usa `localStorage`):
   ```bash
   npm install
   npm test
   npm run dev
   ```
2. Para conectar ao seu Supabase e Stripe:
   - Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
   - Aplique as migrations em `supabase/migrations/` no seu projeto Supabase.
   - Publique as Edge Functions `mr-booking-public`, `mr-stripe-billing` e `mr-stripe-webhook`.
   - Cadastre nos Secrets do Supabase: `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` (e opcionalmente `MR_STRIPE_PORTAL_CONFIG_ID`).

## Build de produção
```bash
npm run build
```
O bundle estático fica em `dist/`, pronto para Cloudflare Pages, Vercel ou empacotamento PWA/Android (TWA).
