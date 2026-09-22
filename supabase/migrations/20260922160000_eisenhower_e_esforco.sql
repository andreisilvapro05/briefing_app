-- Matriz de Eisenhower e tamanho da tarefa.
--
-- Pedido da Karine em 2026-09-22: ao criar uma tarefa, poder marcar (se
-- quiser) em que quadrante ela cai, e se é coisa de cinco minutos ou de dia
-- inteiro.
--
-- Por que não reaproveitar `prioridade`: ela é a bandeira do ClickUp
-- (Urgente/Alta/Normal/Baixa), um eixo só. Eisenhower cruza DOIS eixos —
-- urgente e importante — e o que ele responde não é "qual vem primeiro" e
-- sim "isso é pra fazer, planejar, delegar ou apagar". "Responder e-mail"
-- pode ser urgente e não importante ao mesmo tempo, e é exatamente esse
-- cruzamento que a matriz serve pra deixar visível.
--
-- `esforco` é outro eixo ainda: tarefa de 5 minutos entre duas reuniões não
-- é a mesma coisa que tarefa de um dia, e hoje as duas parecem iguais na
-- lista. Serve pra escolher o que dá pra fechar agora.
--
-- Os dois são OPCIONAIS ("se quiser", nas palavras dela): nulo é o normal,
-- e nada na interface obriga a preencher.
alter table public.project_tasks
  add column if not exists eisenhower text,
  add column if not exists esforco text;

alter table public.project_tasks
  drop constraint if exists project_tasks_eisenhower_check;
alter table public.project_tasks
  add constraint project_tasks_eisenhower_check
  check (eisenhower is null or eisenhower in (
    'fazer',     -- urgente + importante  → Fazer agora
    'planejar',  -- importante, não urgente → Planejar/decidir
    'delegar',   -- urgente, não importante → Delegar
    'eliminar'   -- nem urgente nem importante → Eliminar
  ));

alter table public.project_tasks
  drop constraint if exists project_tasks_esforco_check;
alter table public.project_tasks
  add constraint project_tasks_esforco_check
  check (esforco is null or esforco in (
    'rapido',  -- até 5 minutos
    'curto',   -- até 30 minutos
    'medio',   -- algumas horas
    'longo'    -- um dia ou mais
  ));

-- "O que dá pra fechar agora": quadrante + tamanho, entre as abertas.
create index if not exists project_tasks_eisenhower_idx
  on public.project_tasks (eisenhower, esforco) where eisenhower is not null;

comment on column public.project_tasks.eisenhower is
  'Quadrante da matriz de Eisenhower: fazer (urgente+importante), planejar (importante), delegar (urgente), eliminar. NULL = nao classificada.';
comment on column public.project_tasks.esforco is
  'Tamanho da tarefa: rapido (ate 5 min), curto (ate 30 min), medio (algumas horas), longo (um dia ou mais). NULL = nao estimada.';
