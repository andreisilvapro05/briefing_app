-- ============================================================
-- Google Drive auto-folders por cliente.
--
-- google_drive_folders: JSON { rootId, rootUrl, subfolders: {nome → id} }
--                       Preenchido automaticamente quando o admin cria
--                       um cliente e a integração Drive está ativa.
-- ============================================================

alter table public.clients
  add column if not exists google_drive_folders jsonb;

comment on column public.clients.google_drive_folders is
  'Estrutura de pastas no Google Drive (rootId, rootUrl, subfolders map). Preenchido pela lib/google-drive.ts.';
