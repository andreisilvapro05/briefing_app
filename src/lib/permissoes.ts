/**
 * As regras de autorização, puras — sem nenhuma dependência de servidor.
 *
 * Moram separadas de `member.ts` porque aquele arquivo importa o cliente
 * Supabase, que por sua vez importa `next/headers`: isso tornava as regras
 * impossíveis de verificar fora do Next. E autorização é o código que MAIS
 * merece teste, porque o erro aqui não aparece na tela — aparece quando
 * alguém vê o que não devia.
 *
 * `member.ts` reexporta tudo, então quem já importava de lá continua igual.
 * A matriz de quem pode o quê está travada em testes/permissoes.test.ts.
 */

/**
 * admin: sócio, acesso total. avancado: acesso completo sem ser sócio (ex:
 * atendimento). basico: acesso restrito aos projetos em que a pessoa está
 * marcada — o enforcement é feito por getVisibleClientIds(), aplicado em
 * todas as listas do admin.
 *
 * desenvolvedor: quem implementa as páginas (pedido da Karine, 2026-09-22).
 * Tem o MESMO escopo de clientes do "basico" (só onde tem tarefa), mas
 * enxerga menos telas que ele: uma só, /admin/desenvolvimento, onde estão as
 * tarefas dele e a ficha de implementação de cada uma. A lista de seções
 * permitidas é SECOES_DESENVOLVEDOR, e quem a aplica é o AdminShell — ver
 * podeVerSecao().
 */
export type MemberRole = "admin" | "avancado" | "basico" | "desenvolvedor";

export const ROLE_LABELS: Record<MemberRole, string> = {
  admin: "Admin (sócio)",
  avancado: "Avançado",
  basico: "Básico",
  desenvolvedor: "Desenvolvedor",
};

export const ROLE_HINT: Record<MemberRole, string> = {
  admin: "acesso total, gerencia membros",
  avancado: "acesso completo, não é sócio",
  basico: "restrito aos projetos em que está marcado",
  desenvolvedor: "só as tarefas dele: acessos, Figma, botões e pixel",
};

export interface Member {
  id: string;
  authUserId: string | null;
  email: string;
  name: string;
  role: MemberRole;
  source: "supabase" | "password-legacy" | "url-key-legacy";
  /** true quando entrou pela senha compartilhada, não por identidade própria. */
  legacy: boolean;
  /** Liga esse membro a TEAM_MEMBERS (project-tasks.ts) — o valor gravado em project_tasks.responsavel. null se não ligado (ou "basico" sem tarefas suas). */
  taskValue: string | null;
  /** URL da foto de perfil (Supabase Storage). null = sem foto (mostra iniciais) ou sessão legada. */
  fotoUrl: string | null;
}

export function isAdmin(member: Member): boolean {
  return member.role === "admin";
}

/** Papel "desenvolvedor" — quem implementa as páginas (não é sessão legada). */
export function isDeveloper(member: Member): boolean {
  return member.role === "desenvolvedor" && !member.legacy;
}

/**
 * Papéis cujo alcance é a PRÓPRIA TAREFA, não o projeto inteiro: "basico"
 * (designer) e "desenvolvedor". Os dois veem só os clientes em que estão
 * marcados (getVisibleClientIds) e só editam tarefa em que são o
 * responsável (canEditTask, em admin/[id]/actions.ts).
 *
 * Existe como função própria porque o código checava `role === "basico"`
 * em uma dúzia de lugares: cada um desses pontos teria de ganhar um `||
 * role === "desenvolvedor"` na mão, e o esquecido falharia ABERTO — o
 * desenvolvedor passaria pelo caminho de quem tem acesso total.
 *
 * PENDENTE (2026-09-22): três guardas em `src/app/admin/[id]/actions.ts`
 * ainda comparam com a string "basico" e por isso deixam o desenvolvedor
 * passar como se tivesse acesso completo. Esse arquivo estava sendo editado
 * por outro agente quando este papel foi implementado, então a troca ficou
 * pra depois. As telas dele não usam essas ações (a escrita da tarefa dele
 * é `atualizarMinhaTarefaAction`, em admin/desenvolvimento/actions.ts), mas
 * Server Action é alcançável por POST direto — então isto é dívida de
 * segurança, não de estilo:
 *
 *   • canEditTask (~l.1231):        `if (member.role !== "basico") return true;`
 *                                   → `if (!hasTaskScopedRole(member)) return true;`
 *   • addProjectTaskAction (~l.1128): `if (member.role === "basico") {`
 *                                   → `if (hasTaskScopedRole(member)) {`
 *   • reorderProjectTasksAction (~l.1476): `member.role === "basico" &&`
 *                                   → `hasTaskScopedRole(member) &&`
 */
export function hasTaskScopedRole(member: Member): boolean {
  if (member.legacy) return false;
  return member.role === "basico" || member.role === "desenvolvedor";
}

/**
 * Acesso a Contratos/Cobranças/Projetos Fechados/Relatórios — separado de
 * `hasFullAccess` porque é sobre QUAL SEÇÃO a pessoa vê, não sobre QUAIS
 * CLIENTES. Pedido do usuário (2026-08-31): designer (role "basico") não
 * deve ver dados financeiros de nenhum cliente, nem os que ela mesma
 * atende — só o operacional (projetos, tarefas, EI, briefing).
 *
 * "desenvolvedor" entra no mesmo corte, com folga: ele não vê nem o
 * operacional completo. Além do menu, isso é o que barra as rotas de
 * contrato em /api/admin/contracts/*, que já chamam hasFinanceAccess.
 */
export function hasFinanceAccess(member: Member): boolean {
  return member.role !== "basico" && member.role !== "desenvolvedor";
}

/**
 * Seções do admin (AdminSection, em admin-shell.tsx) que o papel
 * "desenvolvedor" alcança. É uma ALLOWLIST: seção nova nasce fechada pra
 * ele, que é o padrão certo pra um papel externo à operação.
 *
 * - "desenvolvimento": as tarefas dele e a ficha de implementação de cada uma;
 * - "meu-perfil": foto, nome e senha da própria conta.
 *
 * Fora daí não entra nada — nem Processos (documentação interna da
 * agência), nem Meu Trabalho (mostra a carga da equipe e o sync do ClickUp).
 */
export const SECOES_DESENVOLVEDOR: readonly string[] = [
  "desenvolvimento",
  "meu-perfil",
];

/**
 * A pessoa pode abrir esta seção do admin? Hoje só o "desenvolvedor" é
 * recortado por seção; os outros papéis continuam sendo filtrados por
 * clientes (getVisibleClientIds) e por área financeira (hasFinanceAccess).
 *
 * Quem aplica é o AdminShell, que TODA tela do admin renderiza e que recebe
 * `active` obrigatoriamente — assim a barragem não depende de a página se
 * lembrar de chamar nada.
 */
export function podeVerSecao(member: Member, secao: string): boolean {
  if (!isDeveloper(member)) return true;
  return SECOES_DESENVOLVEDOR.includes(secao);
}

/** Pra onde mandar a pessoa quando ela cai numa tela que não é dela. */
export function telaInicialDe(member: Member): string {
  return isDeveloper(member) ? "/admin/desenvolvimento" : "/admin";
}

/**
 * Acesso completo (não restrito por projeto) — admin e avancado. `basico`
 * deveria só ver os projetos em que está marcado como responsável, mas
 * nenhuma tela ainda filtra por isso (fica pra quando existir o vínculo
 * responsável↔projeto); por ora `basico` também enxerga tudo na prática.
 */
export function hasFullAccess(member: Member): boolean {
  return member.role === "admin" || member.role === "avancado" || member.legacy;
}
