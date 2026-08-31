-- Fecha a superfície de escrita de closed_projects e prepara upsert por
-- proposal_id (evita duplicar quando o CRM reenvia o mesmo negócio, ex:
-- mudança de status ou pagamento).
--
-- Contexto: closed_projects nasceu sem RLS (achado em auditoria 2026-08-29,
-- ver pendência de segurança). As 5 linhas existentes hoje foram inseridas
-- manualmente — não há automação em produção usando essa tabela ainda. A
-- partir de agora, a única escrita programática é o endpoint
-- /api/crm/closed-projects (service-role, HMAC validado) e a única leitura
-- é /admin/projetos-fechados (também service-role). Sem policies pra
-- anon/authenticated de propósito — mesmo padrão de
-- 20260707000000_enable_rls_notifications_cobrancas.sql.

create unique index if not exists closed_projects_proposal_id_key
  on public.closed_projects(proposal_id);

alter table public.closed_projects enable row level security;
