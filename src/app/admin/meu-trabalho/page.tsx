import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentMember, getVisibleClientIds, hasFinanceAccess, hasFullAccess,
  isAdmin,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { listAllProjectTasks, listClientOptions } from "@/lib/project-tasks-server";
import { MyWorkBoard } from "@/components/admin/my-work-board";
import { DayHero } from "@/components/admin/day-hero";
import { SubmitTextButton } from "@/components/admin/submit-button";
import { TEAM_MEMBERS, TASK_STATUS_GROUP, type TaskStatus } from "@/lib/project-tasks";

/**
 * "Aberta" = status do grupo ativo. Antes o painel contava
 * `status !== "completo-entregue"`, então "Concluído" entrava como aberta e
 * o número do topo não batia com o banco (Valéria aparecia 136 em vez de
 * 121). O mesmo valia pro "sem responsável", que somava tarefa já fechada.
 */
function ehAtiva(status: TaskStatus): boolean {
  return TASK_STATUS_GROUP[status] === "ativo";
}
import { sincronizarDemandasAction } from "./actions";

export const dynamic = "force-dynamic";

/** Hora local de Brasília, independente do timezone do servidor (Vercel roda em UTC). */
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(new Date())
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName(name: string): string {
  if (name.includes("(sessão compartilhada)")) return "";
  return name.split(" ")[0] ?? name;
}

export default async function MeuTrabalhoPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; sync?: string; res?: string; motivo?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const nome = firstName(member.name);

  // Carrega sempre: mesmo sem vínculo, quem tem visão da equipe precisa ver
  // quanta demanda está sem dono pra poder consertar.
  const podeVerEquipe = hasFullAccess(member);
  const [allTasks, clientOptions] = await Promise.all([
    member.taskValue || podeVerEquipe ? listAllProjectTasks() : [],
    // Opções do "+ Nova demanda" — no escopo de clientes que a pessoa vê.
    member.taskValue
      ? getVisibleClientIds(member).then((ids) => listClientOptions(ids))
      : [],
  ]);
  const myTasks = allTasks.filter((t) => t.responsavel === member.taskValue);
  // "Delegado": tarefas ATIVAS de outras pessoas — o que saiu da minha mão e
  // ainda está rodando. Só pra quem tem visão da equipe (admin/avançado);
  // "básico" não enxerga o trabalho dos outros.
  const delegadas = podeVerEquipe
    ? allTasks.filter(
        (t) => t.responsavel && t.responsavel !== member.taskValue
      )
    : [];

  return (
    <AdminShell
      active="meu-trabalho"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-5">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          {greeting()}{nome ? `, ${nome}` : ""}
        </h1>
      </header>

      <DayHero nome={nome} urlKey={urlKey} />


      {!member.taskValue ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-8 text-center">
          <p className="text-fysi-deep font-medium mb-1">
            Sua conta ainda não está ligada a um responsável de tarefas
          </p>
          <p className="text-sm text-fysi-muted max-w-md mx-auto">
            Pra ver suas tarefas aqui, é preciso ligar seu login ao
            responsável correspondente em{" "}
            <Link
              href={`/admin/membros${keyParam}`}
              className="text-fysi-deep underline"
            >
              Membros
            </Link>
            .
          </p>
        </section>
      ) : (
        <MyWorkBoard
          tasks={myTasks}
          delegadas={delegadas}
          keyParam={keyParam}
          urlKey={urlKey}
          clients={clientOptions}
          meuResponsavel={member.taskValue}
          lockResponsavel={member.role === "basico"}
        />
      )}

      {/* Painel da equipe fica DEPOIS do trabalho da pessoa: o que é meu vem
          primeiro. Antes empurrava "Meu trabalho" pra baixo da dobra. */}
      {podeVerEquipe ? (
        <div className="mt-6">
          <SyncDemandas
            urlKey={urlKey}
            sync={params.sync ?? null}
            res={params.res ?? null}
            motivo={params.motivo ?? null}
            semDono={
              allTasks.filter((t) => !t.responsavel && ehAtiva(t.status)).length
            }
            porPessoa={TEAM_MEMBERS.map((m) => ({
              label: m.label,
              cor: m.cor,
              externo: Boolean(m.externo),
              n: allTasks.filter(
                (t) => t.responsavel === m.value && ehAtiva(t.status)
              ).length,
            }))}
          />
        </div>
      ) : null}
    </AdminShell>
  );
}

/**
 * Barra de sincronização com o ClickUp + panorama de quem está com o quê.
 *
 * Existe porque em 2026-09-20 havia 276 demandas sem responsável contra 61
 * com: o "Meu Trabalho" de todo mundo aparecia vazio e não dava pra saber
 * de quem era o quê. O número de "sem dono" fica visível de propósito — é o
 * indicador de que a distribuição ainda não está certa.
 */
function SyncDemandas({
  urlKey,
  sync,
  res,
  motivo,
  semDono,
  porPessoa,
}: {
  urlKey: string | null;
  sync: string | null;
  res: string | null;
  motivo: string | null;
  semDono: number;
  porPessoa: { label: string; cor: string; n: number; externo: boolean }[];
}) {
  const n = (res ?? "").split("-").map((x) => Number(x) || 0);
  return (
    <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fysi-deep">Demandas da equipe</p>
          <p className="text-xs text-fysi-muted mt-0.5">
            Puxa do ClickUp quem é responsável, o status e o prazo de cada
            demanda. Não cria nem apaga tarefa.
          </p>
        </div>
        <form action={sincronizarDemandasAction}>
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <SubmitTextButton
            className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 whitespace-nowrap disabled:opacity-50"
            pendingLabel="Sincronizando…"
          >
            Sincronizar do ClickUp
          </SubmitTextButton>
        </form>
      </div>

      {sync === "ok" ? (
        <p className="text-sm text-fysi-deep bg-fysi-mint/40 border border-fysi-mint-vivid/40 rounded-[12px] px-4 py-3 mt-3">
          Sincronizado.
          {n[0] > 0
            ? ` ${n[0]} demanda${n[0] === 1 ? "" : "s"} que só existia${n[0] === 1 ? "" : "m"} no ClickUp foi trazida${n[0] === 1 ? "" : "s"} pra cá.`
            : " Nenhuma demanda nova no ClickUp."}
          {n[1] > 0 ? ` ${n[1]} ligada${n[1] === 1 ? "" : "s"} à tarefa de origem.` : ""}
          {n[3] > 0 ? ` ${n[3]} responsáve${n[3] === 1 ? "l" : "is"} atualizado${n[3] === 1 ? "" : "s"}.` : ""}
          {n[4] > 0 ? ` ${n[4]} status.` : ""}
          {n[5] > 0 ? ` ${n[5]} prazo${n[5] === 1 ? "" : "s"}.` : ""}
          {n[6] > 0 ? ` ${n[6]} receberam o dono padrão do tipo de tarefa.` : ""}
          {n[7] > 0
            ? ` ${n[7]} demanda${n[7] === 1 ? "" : "s"} interna${n[7] === 1 ? "" : "s"} (sem cliente) da lista de gestão.`
            : ""}
          {n[2] > 0
            ? ` ${n[2]} do ClickUp ficaram de fora por estarem sem data ("Não programado").`
            : ""}
        </p>
      ) : null}
      {sync === "erro" ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mt-3">
          {motivo ?? "Não consegui sincronizar agora."}
        </p>
      ) : null}

      <ul className="flex flex-wrap gap-2 mt-4">
        {porPessoa.map((p) => (
          <li
            key={p.label}
            className="inline-flex items-center gap-2 rounded-full border border-fysi-line bg-fysi-cream/40 pl-1.5 pr-3 py-1"
          >
            <span
              className={`h-5 w-5 rounded-full ${p.cor} text-white text-[0.6rem] font-semibold flex items-center justify-center`}
            >
              {p.label.slice(0, 1)}
            </span>
            <span className="text-xs text-fysi-deep">
              {p.label}
              {p.externo ? (
                <span className="text-fysi-muted"> (externo)</span>
              ) : null}{" "}
              · <strong className="font-semibold">{p.n}</strong> aberta
              {p.n === 1 ? "" : "s"}
            </span>
          </li>
        ))}
        {semDono > 0 ? (
          <li className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-xs text-amber-900">
              <strong className="font-semibold">{semDono}</strong> sem
              responsável
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
