import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  getCurrentMember,
  isDeveloper,
  podeVerSecao,
  telaInicialDe,
} from "@/lib/member";
import { SearchPalette } from "./search-palette";
import { NotificationsBell } from "./notifications-bell";
import { ProfileAvatar } from "./profile-avatar";
import { ProfileNameLink } from "./profile-name-link";

/**
 * AdminShell — layout do painel no estilo ClickUp: sidebar de ÁREAS da empresa
 * (Projetos / Financeiro / Marketing) à esquerda, barra superior com o usuário,
 * e conteúdo full-width (ocupa a tela, sem margem centralizada desperdiçada).
 *
 * Substitui o antigo Shell + ContentFrame + AdminSidebar nas telas de topo.
 *
 * Também é onde o papel "desenvolvedor" é BARRADO POR SEÇÃO (ver
 * podeVerSecao, em lib/member.ts). O lugar é aqui, e não em cada página,
 * porque toda tela do admin renderiza este componente e toda uma passa
 * `active` — a única exceção são /admin (só redireciona) e /admin/login. Uma
 * página nova não tem como esquecer de se proteger: se ela desenha o painel,
 * passou por esta guarda. Um papel que não alcança a seção leva redirect
 * antes de o HTML existir, mesmo entrando pela URL na mão.
 */

export type AdminSection =
  | "meu-trabalho"
  | "demandas"
  | "equipe"
  | "prioridades"
  | "visao-geral"
  | "clientes"
  | "projetos"
  | "lista"
  | "briefings"
  | "quadro"
  | "tarefas"
  | "desenvolvimento"
  | "estruturas-iniciais"
  | "briefing-documentos"
  | "notas"
  | "marketing-metas"
  | "marketing-planejamento"
  | "processos"
  | "meu-perfil"
  | "conteudo"
  | "contratos"
  | "cobrancas"
  | "relatorios"
  | "projetos-fechados"
  | "custos"
  | "chaves-api"
  | "membros";

interface NavItem {
  id: AdminSection;
  label: string;
  href: (k: string) => string;
  icon: ReactNode;
  /**
   * Subabas. Pedido da Karine (26/09): "unificar em uma aba principal com
   * subaba", apontando pra "Documentos de Briefing" solto ao lado de
   * "Briefings". O menu tinha 22 itens no mesmo nível, e itens que são
   * duas faces da mesma coisa competiam como se fossem assuntos
   * diferentes. A subaba só aparece quando a família está aberta — fechada,
   * o menu encolhe.
   */
  filhos?: NavItem[];
  /**
   * Item que só existe pra abrir a família: o clique cai na PRIMEIRA subaba,
   * então ele não tem tela própria. Fica fora da lista plana do mobile —
   * dois botões pro mesmo endereço é justamente a repetição que a Karine
   * apontou (27/09).
   */
  soGrupo?: boolean;
}

interface NavArea {
  label: string;
  items: NavItem[];
}

function I({ children }: { children: ReactNode }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<AdminSection, ReactNode> = {
  "chaves-api": (
    <I>
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10 13L20 3" />
      <path d="M17 6l2.5 2.5" />
    </I>
  ),
  "meu-trabalho": (
    <I>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </I>
  ),
  equipe: (
    <I>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" />
      <circle cx="17.5" cy="9.5" r="2.4" />
      <path d="M16 14.2c3 .3 5.5 2.7 5.5 5.8" />
    </I>
  ),
  prioridades: (
    <I>
      <path d="M4 20V4M4 20h16" />
      <path d="M4 12h16M12 20V4" opacity="0.45" />
      <circle cx="8" cy="8" r="1.9" fill="currentColor" stroke="none" />
    </I>
  ),
  demandas: (
    <I>
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="15" width="7" height="6" rx="1.5" />
      <rect x="14" y="15" width="7" height="6" rx="1.5" />
    </I>
  ),
  "visao-geral": (
    <I>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </I>
  ),
  clientes: (
    <I>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </I>
  ),
  // Pasta: o guarda-chuva das três visualizações (Por status/Quadro/Tarefas).
  projetos: (
    <I>
      <path d="M3 7a2 2 0 0 1 2-2h3.7l2 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </I>
  ),
  lista: (
    <I>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </I>
  ),
  briefings: (
    <I>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 9h1M9 13h6M9 17h6" />
    </I>
  ),
  quadro: (
    <I>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18" />
    </I>
  ),
  tarefas: (
    <I>
      <rect x="3" y="5" width="4" height="4" rx="1" />
      <path d="M9 7h12" />
      <rect x="3" y="15" width="4" height="4" rx="1" />
      <path d="M9 17h12" />
    </I>
  ),
  desenvolvimento: (
    <I>
      <path d="m8 16-4-4 4-4" />
      <path d="m16 8 4 4-4 4" />
      <path d="M13.5 5 10.5 19" />
    </I>
  ),
  "estruturas-iniciais": (
    <I>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </I>
  ),
  "briefing-documentos": (
    <I>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </I>
  ),
  // Folha em branco com um lápis — documento que nasce vazio.
  notas: (
    <I>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
      <path d="M14 3l4 4v4" />
      <path d="M20.5 13.5a1.6 1.6 0 0 1 2 2L17 21l-3 .7.7-3Z" />
    </I>
  ),
  conteudo: (
    <I>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </I>
  ),
  "marketing-metas": (
    <I>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </I>
  ),
  "marketing-planejamento": (
    <I>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </I>
  ),
  contratos: (
    <I>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 15h6" />
    </I>
  ),
  cobrancas: (
    <I>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </I>
  ),
  relatorios: (
    <I>
      <path d="M3 3v18h18" />
      <rect x="7" y="10" width="3" height="7" />
      <rect x="13" y="6" width="3" height="11" />
    </I>
  ),
  "projetos-fechados": (
    <I>
      <path d="M20 6 9 17l-5-5" />
    </I>
  ),
  custos: (
    <I>
      <path d="M12 3v14M7 12l5 5 5-5M5 21h14" />
    </I>
  ),
  membros: (
    <I>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </I>
  ),
  processos: (
    <I>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </I>
  ),
  "meu-perfil": (
    <I>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </I>
  ),
};

function item(
  id: AdminSection,
  label: string,
  path: string,
  filhos?: NavItem[]
): NavItem {
  return {
    id,
    label,
    href: (k) => `${path}${k}`,
    icon: ICONS[id],
    ...(filhos?.length ? { filhos } : {}),
  };
}

/**
 * Item que é só a porta da família — sem tela própria. O href é o da
 * PRIMEIRA subaba, por construção: assim o grupo não inventa um endereço que
 * ninguém implementou, e mover a subaba padrão é reordenar a lista.
 */
function grupo(id: AdminSection, label: string, filhos: NavItem[]): NavItem {
  return { id, label, href: filhos[0].href, icon: ICONS[id], filhos, soGrupo: true };
}

/** Todos os itens de uma área, pais e filhos, em lista plana. */
function planos(items: NavItem[]): NavItem[] {
  return items.flatMap((it) => [it, ...(it.filhos ?? [])]);
}

/**
 * Telas que existem, funcionam e NUNCA receberam um dado. Somem do menu;
 * a URL segue aberta pra quem souber o caminho.
 *
 * Pedido da Karine (26/09): "remover do app as abas desnecessárias na
 * lateral por enquanto". Medido no banco no mesmo dia:
 *   custos                  → company_costs          0 linhas
 *   marketing-metas         → marketing_goals        0 linhas
 *   marketing-planejamento  → marketing_plano_itens  0 linhas
 *   conteudo                → content_cards          2 linhas
 *
 * "Por enquanto" é literal: tirar do menu não apaga nada, e basta remover
 * o id daqui pra a tela voltar. O menu tinha 22 itens disputando atenção
 * com as 5 ou 6 que se usam todo dia.
 */
const SECOES_GUARDADAS: readonly string[] = [
  "custos",
  "marketing-metas",
  "marketing-planejamento",
  "conteudo",
];

const AREAS: NavArea[] = [
  {
    label: "Projetos",
    items: [
      item("meu-trabalho", "Meu Trabalho", "/admin/meu-trabalho"),
      item("visao-geral", "Visão Geral", "/admin/visao-geral"),
      item("clientes", "Clientes", "/admin/clientes"),
      /**
       * "Por status", "Quadro" e "Tarefas" são a MESMA coisa — os projetos e
       * suas tarefas — vista de três jeitos. Ocupavam três itens de primeiro
       * nível, competindo entre si como se fossem três assuntos.
       *
       * Pedido da Karine (27/09), com seta no print do menu: "não faz
       * sentido ficar repetindo as mesmas coisas, deixar só o que é mais
       * importante, e colocar diferentes visualizações". Uma linha no menu,
       * três views — como as views de uma lista do ClickUp. As URLs não
       * mudaram: link antigo continua abrindo onde abria.
       */
      grupo("projetos", "Projetos", [
        item("lista", "Por status", "/admin/lista"),
        item("quadro", "Quadro", "/admin/quadro"),
        item("tarefas", "Tarefas", "/admin/tarefas"),
      ]),
      item("briefings", "Briefings", "/admin/briefings", [
        item(
          "briefing-documentos",
          "Documentos",
          "/admin/briefing-documentos"
        ),
        // Documento em branco — pedido da Karine (27/09): "uma parte que eu
        // possa criar um documento limpo pra anotar coisas, por exemplo pra
        // criar uma copy nova".
        item("notas", "Em branco", "/admin/notas"),
      ]),
      item("desenvolvimento", "Desenvolvimento", "/admin/desenvolvimento"),
      item("estruturas-iniciais", "Estruturas Iniciais", "/admin/estruturas-iniciais"),
    ],
  },
  {
    label: "Interno",
    items: [
      item("demandas", "Demandas por área", "/admin/demandas"),
      item("equipe", "Equipe", "/admin/equipe"),
      item("prioridades", "Prioridades", "/admin/prioridades"),
    ],
  },
  {
    label: "Financeiro",
    items: [
      item("contratos", "Contratos", "/admin/contratos"),
      item("cobrancas", "Cobranças", "/admin/cobrancas"),
      item("projetos-fechados", "Projetos Fechados", "/admin/projetos-fechados"),
      item("custos", "Custos da empresa", "/admin/custos"),
      item("relatorios", "Relatórios", "/admin/relatorios"),
    ],
  },
  {
    label: "Marketing e Comercial",
    items: [
      item("marketing-metas", "Metas & Indicadores", "/admin/marketing/metas"),
      item("marketing-planejamento", "Planejamento", "/admin/marketing/planejamento"),
      item("conteudo", "Conteúdo", "/admin/conteudo"),
    ],
  },
  {
    label: "Equipe",
    items: [
      item("meu-perfil", "Meu Perfil", "/admin/perfil"),
      item("membros", "Membros", "/admin/membros"),
      item("processos", "Processos & Tutoriais", "/admin/processos"),
      item("chaves-api", "Chaves de API", "/admin/chaves-api"),
    ],
  },
];

const LABELS: Record<AdminSection, { area: string; label: string }> = (() => {
  const m: Record<string, { area: string; label: string }> = {};
  for (const area of AREAS) {
    for (const it of planos(area.items)) m[it.id] = { area: area.label, label: it.label };
  }
  return m as Record<AdminSection, { area: string; label: string }>;
})();

export async function AdminShell({
  active,
  keyParam,
  userEmail,
  userName,
  userPhotoUrl,
  canEditPhoto,
  isSocio = false,
  hideFinance,
  children,
}: {
  active: AdminSection;
  keyParam: string;
  userEmail?: string | null;
  /**
   * Nome/foto vindos do SERVIDOR. Sem eles, o topo buscava o próprio perfil
   * no cliente — duas Server Actions idênticas (nome e avatar) a cada troca
   * de aba, cada uma refazendo getCurrentMember. O servidor já tem esses
   * dados na page: passar por prop tira 2 idas ao servidor por navegação.
   */
  userName?: string | null;
  userPhotoUrl?: string | null;
  canEditPhoto?: boolean;
  /**
   * Sócio (isAdmin). "Custos da empresa" tem o salário de cada um, então não
   * basta ter acesso ao Financeiro. Padrão `false` — falha fechada: quem não
   * passar a prop não vê o item.
   */
  isSocio?: boolean;
  /** Esconde a área Financeiro (Contratos/Cobranças/Projetos Fechados/Relatórios) do menu — role "basico" (ex: designer) não tem acesso a dados financeiros. */
  hideFinance?: boolean;
  children: ReactNode;
}) {
  const crumb = LABELS[active];
  const initials = (userName || userEmail || "F").slice(0, 2).toUpperCase();
  const urlKey = keyParam ? new URLSearchParams(keyParam).get("key") : null;

  // ---- Autorização por seção (não é autenticação: a página já checou isso) ----
  // getCurrentMember é memoizada com cache() por renderização, então esta
  // chamada não custa consulta extra — a página já a fez com a MESMA urlKey
  // (todas derivam `keyParam` de `urlKey`, então as duas chaves batem).
  const quem = await getCurrentMember({ urlKey });
  if (quem && !podeVerSecao(quem, active)) {
    redirect(`${telaInicialDe(quem)}${keyParam}`);
  }
  // `quem` nulo não passa por aqui na prática: toda página do admin manda
  // pro login antes de renderizar o shell. Se passasse, o menu abreviado é
  // o lado seguro de errar.
  const soDesenvolvimento = !!quem && isDeveloper(quem);

  // "básico" (mesmo flag do Financeiro) também não vê Marketing e Comercial:
  // metas guardam alvos de faturamento — dado comercial sensível.
  // "Interno" entra no mesmo corte: as gavetas de Demandas são Comercial,
  // Curso e Financeiro, e o dashboard de Equipe mostra a carga dos outros.
  // Telas guardadas saem do menu antes de qualquer outro filtro — ver
  // SECOES_GUARDADAS. Área que fica vazia por causa disso some junto.
  const areasComUso = AREAS.map((a) => ({
    ...a,
    items: a.items.filter((it) => !SECOES_GUARDADAS.includes(it.id)),
  })).filter((a) => a.items.length > 0);

  const areasVisiveis = hideFinance
    ? areasComUso.filter(
        (a) =>
          a.label !== "Financeiro" &&
          a.label !== "Marketing e Comercial" &&
          a.label !== "Interno"
      )
    : areasComUso;
  // "Custos da empresa" some pra quem não é sócio — mostrar um item que só
  // redireciona é pior que não mostrar.
  const areasPorCargo = isSocio
    ? areasVisiveis
    : areasVisiveis.map((a) => ({
        ...a,
        items: a.items.filter((it) => it.id !== "custos"),
      }));
  // "Desenvolvimento" é a tela DELE. Pedido da Karine (23/09): "a parte do
  // Daniel pode ficar junto com os outros projetos também, só que na tela
  // dele só aparece pra ele". Pra equipe, o trabalho de implementação já
  // está onde o trabalho está — nas Tarefas, na ficha do cliente e na
  // Estrutura Inicial, onde a ficha de implementação é preenchida. Um item
  // de menu só pra isso era um quarto lugar pra procurar a mesma coisa.
  // A URL continua aberta pra quem tem acesso completo, se precisar.
  const areasPorPapel = soDesenvolvimento
    ? areasPorCargo
    : areasPorCargo
        .map((a) => ({
          ...a,
          items: a.items.filter((it) => it.id !== "desenvolvimento"),
        }))
        .filter((a) => a.items.length > 0);
  // O desenvolvedor vê UM menu com o que ele alcança de fato — a mesma lista
  // que o servidor usa pra barrar, então não sobra item que só redireciona.
  const areas =
    soDesenvolvimento && quem
      ? areasPorPapel
          .map((a) => ({
            ...a,
            items: a.items
              .filter((it) => podeVerSecao(quem, it.id))
              // O filho herda a mesma régua: um pai visível não pode
              // carregar pra dentro uma tela que o servidor barra.
              .map((it) =>
                it.filhos
                  ? { ...it, filhos: it.filhos.filter((f) => podeVerSecao(quem, f.id)) }
                  : it
              ),
          }))
          .filter((a) => a.items.length > 0)
      : areasPorPapel;

  return (
    <div className="min-h-screen flex bg-fysi-cream text-fysi-deep">
      {/* Sidebar de áreas */}
      <aside className="hidden md:flex w-[236px] shrink-0 flex-col bg-white border-r border-fysi-line h-screen sticky top-0">
        <Link
          href={`/admin${keyParam}`}
          className="flex items-center gap-2.5 px-4 h-14 border-b border-fysi-line hover:bg-fysi-cream/60 transition shrink-0"
        >
          <span className="w-8 h-8 grid place-items-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fysilab-symbol.png" alt="" className="h-full w-auto" />
          </span>
          <span className="flex flex-col leading-tight min-w-0">
            <span className="text-sm font-semibold tracking-tight truncate">
              Fysi Workspace
            </span>
            <span className="text-[0.72rem] text-fysi-muted">Painel interno</span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3 flex flex-col gap-4">
          {areas.map((area) => (
            <div key={area.label}>
              <p className="px-2 mb-1 text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold">
                {area.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {area.items.map((it) => {
                  const isActive = it.id === active;
                  const familiaAberta =
                    isActive || !!it.filhos?.some((f) => f.id === active);
                  /**
                   * O item que é só porta da família não tem tela própria, logo
                   * nunca é `active` — sem isto o menu ficava sem NADA aceso
                   * enquanto se olhava uma das subabas, e a barra lateral
                   * parecia não saber onde a pessoa está. Ele herda o aceso da
                   * subaba: seção em destaque, subaba marcada dentro dela.
                   */
                  const aceso = isActive || (!!it.soGrupo && familiaAberta);
                  return (
                    <li key={it.id}>
                      <Link
                        href={it.href(keyParam)}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-[0.86rem] font-medium border transition",
                          aceso
                            ? "bg-fysi-deep border-fysi-deep text-fysi-cream font-semibold"
                            : "border-transparent text-fysi-deep hover:bg-fysi-cream"
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0",
                            aceso ? "text-fysi-cream" : "text-fysi-muted"
                          )}
                        >
                          {it.icon}
                        </span>
                        {it.label}
                      </Link>
                      {/* A subaba só aparece com a família aberta: fechada,
                          o menu encolhe e o assunto ocupa uma linha só. */}
                      {it.filhos?.length && familiaAberta ? (
                        <ul className="mt-0.5 ml-[18px] pl-3 border-l border-fysi-line flex flex-col gap-0.5">
                          {it.filhos.map((f) => {
                            const filhoAtivo = f.id === active;
                            return (
                              <li key={f.id}>
                                <Link
                                  href={f.href(keyParam)}
                                  aria-current={filhoAtivo ? "page" : undefined}
                                  className={cn(
                                    "block px-2.5 py-1.5 rounded-[8px] text-[0.8rem] transition",
                                    filhoAtivo
                                      ? "bg-fysi-cream text-fysi-deep font-semibold"
                                      : "text-fysi-muted hover:bg-fysi-cream hover:text-fysi-deep"
                                  )}
                                >
                                  {f.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Coluna principal */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Topbar com usuário */}
        <header className="h-14 shrink-0 border-b border-fysi-line bg-white/90 backdrop-blur flex items-center justify-between gap-3 px-4 md:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0 text-sm shrink-0">
            <span className="md:hidden font-semibold">fysilab</span>
            <span className="hidden md:inline text-fysi-muted">
              {crumb?.area ?? "Painel"}
            </span>
            <span className="hidden md:inline text-fysi-muted/50">/</span>
            <span className="font-semibold truncate">{crumb?.label ?? ""}</span>
          </div>
          {/* A busca abre ficha de cliente, briefing e EI — telas que o
              desenvolvedor não alcança. Mostrá-la seria oferecer um caminho
              que só termina em redirect. */}
          <div className="flex-1 flex justify-center px-2 min-w-0">
            {soDesenvolvimento ? null : (
              <SearchPalette keyParam={keyParam} urlKey={urlKey} />
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <NotificationsBell keyParam={keyParam} urlKey={urlKey} />
            <span className="hidden sm:flex flex-col items-end leading-tight">
              <ProfileNameLink
                urlKey={urlKey}
                keyParam={keyParam}
                name={userName ?? null}
                fallback={userEmail ?? null}
              />
              <form method="post" action="/api/auth/admin-logout">
                <button
                  type="submit"
                  className="text-[0.74rem] text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
                >
                  sair
                </button>
              </form>
            </span>
            <ProfileAvatar
              urlKey={urlKey}
              fallbackInitials={initials}
              fotoUrl={userPhotoUrl ?? null}
              canEdit={canEditPhoto}
            />
          </div>
        </header>

        {/* Nav horizontal no mobile */}
        <nav className="md:hidden border-b border-fysi-line bg-white overflow-x-auto">
          <ul className="flex gap-1 px-3 py-2 w-max">
            {/* Aqui pai e filho ficam lado a lado, sem hierarquia pra
                mostrar — então o item que é só porta da família (soGrupo)
                repetiria o endereço da primeira subaba. */}
            {areas
              .flatMap((a) => planos(a.items))
              .filter((it) => !it.soGrupo)
              .map((it) => {
                const isActive = it.id === active;
                return (
                  <li key={it.id}>
                    <Link
                      href={it.href(keyParam)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition",
                        isActive
                          ? "bg-fysi-deep border-fysi-deep text-fysi-cream"
                          : "border-fysi-line text-fysi-muted"
                      )}
                    >
                      {it.icon}
                      {it.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </nav>

        <main className="flex-1 min-w-0 px-4 md:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
