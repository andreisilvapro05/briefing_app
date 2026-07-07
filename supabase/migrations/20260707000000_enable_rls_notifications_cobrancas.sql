-- Habilita RLS em admin_notifications e cobrancas_mensais.
--
-- Auditoria (2026-07): ambas as tabelas nasceram SEM row level security.
-- Como a anon key é pública (NEXT_PUBLIC_SUPABASE_ANON_KEY vai pro client),
-- qualquer pessoa podia ler PII de clientes e dados financeiros direto pela
-- API REST do Supabase, sem passar pelo app.
--
-- No briefing_app essas tabelas são acessadas EXCLUSIVAMENTE via service-role
-- (createSupabaseServiceRoleClient), que tem BYPASSRLS. Logo, habilitar RLS
-- SEM policies não quebra nada no servidor e bloqueia todo acesso via anon —
-- fechando o vazamento apontado na auditoria.

alter table public.admin_notifications enable row level security;
alter table public.cobrancas_mensais enable row level security;
