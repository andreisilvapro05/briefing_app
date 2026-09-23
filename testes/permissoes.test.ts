import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SECOES_DESENVOLVEDOR,
  hasFinanceAccess,
  hasFullAccess,
  hasTaskScopedRole,
  isAdmin,
  isDeveloper,
  podeVerSecao,
  telaInicialDe,
  type Member,
  type MemberRole,
} from "../src/lib/permissoes.ts";

/**
 * A regra que estas verificações protegem: quem pode o quê.
 *
 * Permissão é o lugar onde errar não dá erro — ninguém vê tela de falha,
 * a pessoa só passa a enxergar o que não é dela. Foi o que aconteceu em
 * 22/09: o papel "desenvolvedor" nasceu depois de uma dúzia de guardas
 * escritas como `role === "basico"`, e cada guarda esquecida falhava
 * ABERTA — o desenvolvedor passava pelo caminho de quem tem acesso total.
 *
 * Por isso o formato aqui é uma TABELA: uma linha por papel, uma coluna
 * por capacidade, conferida célula a célula. Mudar uma regra exige mudar
 * a tabela, e mudar a tabela é uma decisão consciente — que é exatamente
 * o ponto de parada que se quer.
 *
 * Nada de banco: só as funções puras (Member → boolean/string).
 * `getCurrentMember` e `getVisibleClientIds` falam com o Supabase e ficam
 * de fora.
 */

function membro(role: MemberRole, extras: Partial<Member> = {}): Member {
  return {
    id: "m1",
    authUserId: "auth-1",
    email: "pessoa@exemplo.fake",
    name: "Pessoa de Teste",
    role,
    source: "supabase",
    legacy: false,
    taskValue: "Pessoa",
    fotoUrl: null,
    ...extras,
  };
}

/** A sessão antiga por senha compartilhada, como o app a constrói de fato. */
const sessaoLegada: Member = {
  id: "legacy",
  authUserId: null,
  email: "admin@fysilab",
  name: "Equipe Fysi (sessão compartilhada)",
  role: "admin",
  source: "password-legacy",
  legacy: true,
  taskValue: null,
  fotoUrl: null,
};

// --- As seções reais do app, lidas do arquivo (ver o comentário do teste
// "toda seção da allowlist existe de verdade" pra saber por que por regex).
const ADMIN_SHELL = new URL(
  "../src/components/admin/admin-shell.tsx",
  import.meta.url
);

function secoesDoTipo(): string[] {
  const fonte = readFileSync(ADMIN_SHELL, "utf8");
  const bloco = /export type AdminSection\s*=([\s\S]*?);/.exec(fonte);
  assert.ok(bloco, "não achei o tipo AdminSection — o arquivo mudou de forma");
  return [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function secoesDoMenu(): string[] {
  const fonte = readFileSync(ADMIN_SHELL, "utf8");
  return [...fonte.matchAll(/\bitem\(\s*"([^"]+)"/g)].map((m) => m[1]);
}

const TODAS_AS_SECOES = secoesDoTipo();

// ---------------------------------------------------------------------------
// A MATRIZ
// ---------------------------------------------------------------------------

interface Linha {
  quem: string;
  membro: Member;
  isAdmin: boolean;
  isDeveloper: boolean;
  /** alcance é a própria tarefa, não o projeto inteiro */
  hasTaskScopedRole: boolean;
  /** Contratos, Cobranças, Projetos Fechados, Relatórios */
  hasFinanceAccess: boolean;
  /** enxerga todos os clientes (não filtra por getVisibleClientIds) */
  hasFullAccess: boolean;
  telaInicial: string;
  /** "todas" = nenhum recorte por seção; senão, a lista exata que alcança */
  secoes: "todas" | readonly string[];
}

const MATRIZ: readonly Linha[] = [
  {
    quem: "admin (sócio)",
    membro: membro("admin"),
    isAdmin: true,
    isDeveloper: false,
    hasTaskScopedRole: false,
    hasFinanceAccess: true,
    hasFullAccess: true,
    telaInicial: "/admin",
    secoes: "todas",
  },
  {
    quem: "avancado (atendimento)",
    membro: membro("avancado"),
    isAdmin: false,
    isDeveloper: false,
    hasTaskScopedRole: false,
    hasFinanceAccess: true,
    hasFullAccess: true,
    telaInicial: "/admin",
    secoes: "todas",
  },
  {
    quem: "basico (designer)",
    membro: membro("basico"),
    isAdmin: false,
    isDeveloper: false,
    hasTaskScopedRole: true,
    // não vê dado financeiro de NENHUM cliente, nem dos que atende
    hasFinanceAccess: false,
    hasFullAccess: false,
    telaInicial: "/admin",
    // o recorte do "basico" é por CLIENTE, não por seção
    secoes: "todas",
  },
  {
    quem: "desenvolvedor",
    membro: membro("desenvolvedor"),
    isAdmin: false,
    isDeveloper: true,
    hasTaskScopedRole: true,
    hasFinanceAccess: false,
    hasFullAccess: false,
    telaInicial: "/admin/desenvolvimento",
    // duas telas, e só: as tarefas dele e o próprio perfil
    secoes: ["desenvolvimento", "meu-perfil"],
  },
  {
    quem: "sessão legada (senha compartilhada)",
    membro: sessaoLegada,
    isAdmin: true,
    isDeveloper: false,
    // legado nunca é recortado por tarefa: é a equipe inteira num login só
    hasTaskScopedRole: false,
    hasFinanceAccess: true,
    hasFullAccess: true,
    telaInicial: "/admin",
    secoes: "todas",
  },
];

test("a matriz de capacidades vale célula a célula", () => {
  for (const linha of MATRIZ) {
    const m = linha.membro;
    assert.equal(isAdmin(m), linha.isAdmin, `isAdmin — ${linha.quem}`);
    assert.equal(isDeveloper(m), linha.isDeveloper, `isDeveloper — ${linha.quem}`);
    assert.equal(
      hasTaskScopedRole(m),
      linha.hasTaskScopedRole,
      `hasTaskScopedRole — ${linha.quem}`
    );
    assert.equal(
      hasFinanceAccess(m),
      linha.hasFinanceAccess,
      `hasFinanceAccess — ${linha.quem}`
    );
    assert.equal(
      hasFullAccess(m),
      linha.hasFullAccess,
      `hasFullAccess — ${linha.quem}`
    );
    assert.equal(telaInicialDe(m), linha.telaInicial, `telaInicialDe — ${linha.quem}`);
  }
});

test("a matriz vale para TODAS as seções do admin, uma a uma", () => {
  // Aqui é onde um papel "quase certo" apareceria: basta uma seção nova
  // entrar no app pra esta conferência passar a cobri-la também.
  assert.ok(TODAS_AS_SECOES.length >= 20, "extraí seções demais ou de menos");
  for (const linha of MATRIZ) {
    for (const secao of TODAS_AS_SECOES) {
      const esperado =
        linha.secoes === "todas" ? true : linha.secoes.includes(secao);
      assert.equal(
        podeVerSecao(linha.membro, secao),
        esperado,
        `${linha.quem} → ${secao}`
      );
    }
  }
});

test("a tela inicial de cada papel é uma tela que ele alcança", () => {
  // Mandar alguém pra uma tela que ele não pode ver é um laço de redirect:
  // o AdminShell barra e manda de volta pro mesmo lugar.
  for (const linha of MATRIZ) {
    const destino = telaInicialDe(linha.membro);
    assert.ok(destino.startsWith("/admin"), `${linha.quem}: ${destino}`);
    const secao = destino.replace(/^\/admin\/?/, "");
    if (secao === "") continue; // "/admin" só redireciona, não é seção
    assert.ok(
      podeVerSecao(linha.membro, secao),
      `${linha.quem} é mandado pra "${secao}", que ele não alcança`
    );
  }
});

// ---------------------------------------------------------------------------
// A ALLOWLIST
// ---------------------------------------------------------------------------

test("seção desconhecida é NEGADA pro desenvolvedor (nasce fechada)", () => {
  const dev = membro("desenvolvedor");
  for (const inventada of [
    "financeiro-novo", // uma seção que alguém criar amanhã
    "", // string vazia
    "desenvolvimento/ficha", // sub-rota, não é a seção
    "Desenvolvimento", // maiúscula: a comparação é exata
    "desenvolvimento ", // espaço sobrando ao colar
    "meu-perfil-do-cliente", // prefixo parecido
  ]) {
    assert.equal(
      podeVerSecao(dev, inventada),
      false,
      `desenvolvedor não pode ver "${inventada}"`
    );
  }
});

test("a allowlist não limita os outros papéis", () => {
  // Só o desenvolvedor é recortado por seção. Se um dia alguém inverter o
  // sinal em podeVerSecao, o admin perderia o app inteiro em silêncio.
  for (const m of [membro("admin"), membro("avancado"), membro("basico"), sessaoLegada]) {
    assert.equal(podeVerSecao(m, "financeiro-novo"), true, m.role);
    assert.equal(podeVerSecao(m, "contratos"), true, m.role);
  }
});

test("toda seção da allowlist existe de verdade", () => {
  // Esta é a que vale ouro: um nome errado em SECOES_DESENVOLVEDOR não dá
  // erro nenhum — só abre (ou fecha) uma tela silenciosamente.
  //
  // AdminSection é um tipo do TypeScript: some na compilação e não dá pra
  // importar em runtime. Vive num `.tsx`, que o runner do Node não
  // processa (não tira JSX). Então a lista é extraída do arquivo por
  // regex — feio, mas é o que mantém as duas listas amarradas sem mexer
  // em `src/`.
  for (const secao of SECOES_DESENVOLVEDOR) {
    assert.ok(
      TODAS_AS_SECOES.includes(secao),
      `"${secao}" está na allowlist mas não é uma AdminSection`
    );
  }
});

test("toda seção da allowlist tem item de menu", () => {
  // Sem item no menu, o desenvolvedor logaria numa barra lateral vazia:
  // o AdminShell monta o menu dele filtrando os itens pela MESMA lista.
  const doMenu = secoesDoMenu();
  assert.ok(doMenu.length >= 20, "não consegui ler os itens do menu");
  for (const secao of SECOES_DESENVOLVEDOR) {
    assert.ok(doMenu.includes(secao), `"${secao}" não tem item de menu`);
  }
});

test("a allowlist não tem repetido nem entrada vazia", () => {
  assert.equal(
    new Set(SECOES_DESENVOLVEDOR).size,
    SECOES_DESENVOLVEDOR.length,
    "seção repetida na allowlist"
  );
  for (const s of SECOES_DESENVOLVEDOR) {
    assert.equal(s, s.trim(), `"${s}" tem espaço sobrando`);
    assert.notEqual(s, "", "entrada vazia liberaria uma seção sem nome");
  }
});

// ---------------------------------------------------------------------------
// O LADO LEGADO
// ---------------------------------------------------------------------------

test("a sessão legada nunca é confundida com um papel restrito", () => {
  // `legacy` é a senha compartilhada: não é pessoa, é a equipe inteira.
  // Se ela caísse em hasTaskScopedRole ou isDeveloper, o app inteiro
  // passaria a se comportar como se a Karine fosse uma designer sem
  // tarefa — e ela veria ZERO clientes (getVisibleClientIds devolve Set
  // vazio pra quem não tem taskValue, e legado não tem).
  assert.equal(sessaoLegada.taskValue, null);
  assert.equal(hasTaskScopedRole(sessaoLegada), false);
  assert.equal(isDeveloper(sessaoLegada), false);
  assert.equal(hasFullAccess(sessaoLegada), true);
});

test("o flag legacy vence o papel gravado, menos no financeiro", () => {
  // Combinação que HOJE não existe: legacyMember() sempre nasce "admin",
  // então nenhuma sessão legada chega aqui com outro papel. O teste está
  // aqui pra registrar a régua caso isso mude — repare que ela é
  // incoerente: `legacy` desliga o recorte por tarefa e liga o acesso
  // total, mas hasFinanceAccess olha SÓ o papel e ignora o flag.
  const legadoBasico: Member = { ...sessaoLegada, role: "basico" };
  assert.equal(hasTaskScopedRole(legadoBasico), false, "legacy desliga o recorte");
  assert.equal(hasFullAccess(legadoBasico), true, "legacy dá acesso total");
  assert.equal(hasFinanceAccess(legadoBasico), false, "mas o financeiro olha o papel");

  const legadoDev: Member = { ...sessaoLegada, role: "desenvolvedor" };
  assert.equal(isDeveloper(legadoDev), false, "legacy não é o desenvolvedor real");
  assert.equal(podeVerSecao(legadoDev, "contratos"), true);
  assert.equal(telaInicialDe(legadoDev), "/admin");
});

// ---------------------------------------------------------------------------
// A ASSIMETRIA: seção nova nasce FECHADA, papel novo nasce ABERTO
// ---------------------------------------------------------------------------

test("papel desconhecido entra no financeiro sozinho (régua atual)", () => {
  // hasFinanceAccess é DENYLIST (`!== "basico" && !== "desenvolvedor"`),
  // ao contrário de SECOES_DESENVOLVEDOR, que é allowlist. Consequência:
  // um quinto papel criado amanhã — "estagiário", "freelancer" — vê
  // Contratos, Cobranças e Relatórios sem ninguém ter decidido isso.
  //
  // Não está marcado como bug porque hoje é inalcançável: a coluna
  // team_members.role tem CHECK com os 4 papéis (migration
  // 20260831000000). Este teste trava a régua atual; o dia em que alguém
  // acrescentar um papel ao CHECK, ele falha aqui e obriga a decidir.
  const futuro = membro("estagiario" as MemberRole);
  assert.equal(hasFinanceAccess(futuro), true, "entra no financeiro por omissão");
  assert.equal(hasFullAccess(futuro), false, "mas não enxerga os clientes");
  assert.equal(podeVerSecao(futuro, "cobrancas"), true);
  assert.equal(hasTaskScopedRole(futuro), false, "e não é recortado por tarefa");
});

test("os quatro papéis do tipo são os quatro do banco", () => {
  // Se a união MemberRole e o CHECK do banco divergirem, um papel válido
  // no banco cai no caminho de "papel desconhecido" acima — e ganha o
  // financeiro de graça.
  const migration = new URL(
    "../supabase/migrations/20260831000000_add_team_members.sql",
    import.meta.url
  );
  const sql = readFileSync(migration, "utf8");
  const check = /check\s*\(\s*role\s+in\s*\(([^)]*)\)/i.exec(sql);
  assert.ok(check, "não achei o CHECK de role na migration");
  const noBanco = [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  const noTipo: MemberRole[] = ["admin", "avancado", "basico", "desenvolvedor"];
  assert.deepEqual(noBanco, [...noTipo].sort());
});
