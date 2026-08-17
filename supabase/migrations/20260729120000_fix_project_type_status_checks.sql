-- Corrige os CHECKs de clients que ficaram defasados em relação ao app.
--
-- project_type: o app passou a oferecer 'seo' e 'outro' (fluxo /contratar),
-- mas o CHECK original só permitia landing-com-copy/landing-sem-copy/
-- site-completo → INSERT de cliente que escolhe "Outro serviço" falhava
-- com "create-failed".
--
-- status: a UI (StatusChanger) usa 'parado', que não estava no CHECK original.

alter table public.clients
  drop constraint if exists clients_project_type_check;

alter table public.clients
  add constraint clients_project_type_check
  check (
    project_type is null
    or project_type in (
      'landing-com-copy',
      'landing-sem-copy',
      'site-completo',
      'seo',
      'outro'
    )
  );

alter table public.clients
  drop constraint if exists clients_status_check;

alter table public.clients
  add constraint clients_status_check
  check (
    status in (
      'nao-iniciado',
      'em-andamento',
      'parado',
      'concluido',
      'abandonado'
    )
  );
