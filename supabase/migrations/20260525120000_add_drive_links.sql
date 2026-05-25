-- ============================================================
-- Links de Drive (modo manual — sem integração com Google API).
--
-- fysi_drive_link:   URL da pasta que a Fysi cria no Drive interno
--                    pra esse cliente. Admin cola aqui depois de criar.
-- cliente_drive_link: URL de uma pasta Drive DO PRÓPRIO CLIENTE
--                    com materiais que ele já tem (logos, fotos, etc.).
--
-- Ambos opcionais. Visíveis no admin; o do Fysi também aparece no
-- dashboard do cliente.
-- ============================================================

alter table public.clients
  add column if not exists fysi_drive_link text,
  add column if not exists cliente_drive_link text;

comment on column public.clients.fysi_drive_link is
  'Link da pasta criada no Drive da Fysi pra esse cliente (admin cola).';
comment on column public.clients.cliente_drive_link is
  'Link da pasta Drive do próprio cliente com materiais existentes.';
