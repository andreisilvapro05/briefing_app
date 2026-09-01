-- clients_self_update permitia que QUALQUER cliente autenticado (via magic-link)
-- reescrevesse qualquer coluna da própria linha direto pela REST API do
-- Supabase (pagamento_pago, pagamento_total, status, contrato_status,
-- contrato_signed_url, etc), sem passar por nenhuma regra de negócio do app.
-- Confirmado que o app NUNCA usa o client-side Supabase (createBrowserClient
-- existe em src/lib/supabase/browser.ts mas não é chamado em lugar nenhum) —
-- toda escrita real passa pelo service-role client no servidor. Essas
-- policies não tinham nenhuma função legítima, só expunham um jeito de
-- burlar o app inteiro.
drop policy if exists clients_self_update on public.clients;
drop policy if exists clients_self_select on public.clients;
