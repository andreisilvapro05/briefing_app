-- Dois pedidos da Karine (28/09) e uma divergência encontrada no caminho.
--
-- 1. "tire a Carla dali" — a Carla's Cleaning Service é cliente de TRÁFEGO,
--    não de landing page, e aparecia na mesma lista de projetos. Tráfego
--    vira um tipo de projeto próprio.
--
-- 2. "use o nome do ClickUp por enquanto" — os nomes divergem entre os dois
--    sistemas ("Babi Taróloga" aqui, "Babi" lá; "Krmk Marcas" aqui,
--    "Katlyn (Registro De Marcas)" lá), e é o que faz o casamento falhar.
--    O nome do ClickUp entra em coluna PRÓPRIA em vez de sobrescrever o
--    nome real: assim nada se perde e "depois melhoramos" continua
--    possível.
--
-- 3. DIVERGÊNCIA: o CHECK aceitava só 3 tipos enquanto o código oferece 5
--    (PROJECT_TYPE_VALUES em src/lib/projetos-incompletos.ts inclui 'seo' e
--    'outro'). Escolher SEO na tela estouraria o CHECK. Corrigido junto.

alter table public.clients
  drop constraint if exists clients_project_type_check;

alter table public.clients
  add constraint clients_project_type_check
  check (project_type in (
    'landing-com-copy',
    'landing-sem-copy',
    'site-completo',
    'seo',
    'trafego',
    'outro'
  ));

alter table public.clients
  -- Nome da tarefa no ClickUp. Só pra casar e pra exibir enquanto a
  -- migração acontece; o nome real do cliente segue em `nome`/`empresa`.
  add column if not exists clickup_nome text;

comment on column public.clients.clickup_nome is
  'Nome da tarefa correspondente no ClickUp. Usado pra casar e exibir durante a migração; não substitui nome/empresa.';
