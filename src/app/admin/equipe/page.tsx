import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getCurrentMember,
  hasFinanceAccess,
  hasFullAccess,
  isAdmin,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { listAllProjectTasks } from "@/lib/project-tasks-server";
import {
  AREAS,
  TASK_STATUS_GROUP,
  TASK_STATUS_OPTIONS,
  TEAM_MEMBERS,
  type ProjectTask,
} from "@/lib/project-tasks";
import type { ProjectTaskClient } from "@/lib/project-tasks-server";

export const dynamic = "force-dynamic";

type Task = ProjectTask & { client: ProjectTaskClient | null };

/** Hoje em Brasília — fuso fixo pra servidor e navegador concordarem. */
function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function diaMes(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00Z`)
      .toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      })
      .replace(" de ", " ")
      .replace(".", "");
  } catch {
    return iso;
  }
}

/**
 * Dashboard da equipe — um cartão por pessoa.
 *
 * Pedido da Karine (2026-09-21): "precisa ter o dashboard de cada membro da
 * equipe". A aba "Delegado" do Meu Trabalho já listava tarefa de outra
 * pessoa, mas como uma lista corrida: não dava pra ver a carga de cada um
 * lado a lado, nem quem está afogado e quem está livre.
 *
 * Só pra quem tem visão da equipe: o papel "basico" vê o próprio trabalho em
 * Meu Trabalho e não deve enxergar a carga dos outros.
 */
export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  if (!hasFullAccess(member)) redirect(`/admin/meu-trabalho${keyParam}`);

  const todas = await listAllProjectTasks();
  const hoje = hojeSP();

  const porPessoa = TEAM_MEMBERS.map((m) => {
    const minhas = todas.filter((t) => t.responsavel === m.value);
    const abertas = minhas.filter(
      (t) => TASK_STATUS_GROUP[t.status] === "ativo"
    );
    const atrasadas = abertas.filter(
      (t) => t.data_vencimento && t.data_vencimento < hoje
    );
    const hojeVence = abertas.filter((t) => t.data_vencimento === hoje);
    const proximas = abertas
      .filter((t) => t.data_vencimento && t.data_vencimento > hoje)
      .sort((a, b) =>
        (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? "")
      );
    const semPrazo = abertas.filter((t) => !t.data_vencimento);
    const feitas = minhas.filter(
      (t) => TASK_STATUS_GROUP[t.status] === "fechado"
    );
    // Em quantos projetos diferentes a pessoa está — "espalhada em 9 clientes"
    // diz mais sobre a carga do que o número cru de tarefas.
    const clientes = new Set(
      abertas.map((t) => t.client_id).filter(Boolean) as string[]
    );
    return {
      membro: m,
      abertas,
      atrasadas,
      hojeVence,
      proximas,
      semPrazo,
      feitas,
      clientes: clientes.size,
      internas: abertas.filter((t) => !t.client_id).length,
    };
  }).sort((a, b) => b.atrasadas.length - a.atrasadas.length || b.abertas.length - a.abertas.length);

  const semDono = todas.filter(
    (t) => !t.responsavel && TASK_STATUS_GROUP[t.status] === "ativo"
  );

  return (
    <AdminShell
      active="equipe"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Equipe
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          A carga de cada pessoa, lado a lado. Quem tem demanda vencida
          aparece primeiro.
        </p>
      </header>

      {semDono.length > 0 ? (
        <div className="mb-5 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            <strong className="font-semibold">{semDono.length}</strong> demanda
            {semDono.length === 1 ? "" : "s"} aberta
            {semDono.length === 1 ? "" : "s"} sem responsável.{" "}
            <Link
              href={`/admin/tarefas${keyParam}`}
              className="underline underline-offset-2"
            >
              Distribuir
            </Link>
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {porPessoa.map((p) => (
          <section
            key={p.membro.value}
            className="bg-white border border-fysi-line rounded-[18px] shadow-fysi-card p-5 flex flex-col"
          >
            <div className="flex items-center gap-3">
              <span
                className={`h-10 w-10 shrink-0 rounded-full grid place-items-center text-sm font-bold text-white ${p.membro.cor} ${
                  p.membro.externo
                    ? "outline-2 outline-dashed outline-offset-2 outline-fysi-deep/40"
                    : ""
                }`}
              >
                {p.membro.iniciais}
              </span>
              <div className="min-w-0">
                <p className="text-[0.95rem] font-semibold text-fysi-deep truncate">
                  {p.membro.label}
                  {p.membro.externo ? (
                    <span className="ml-1.5 text-[0.65rem] uppercase tracking-[0.08em] text-fysi-muted font-medium">
                      externo
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-fysi-muted">
                  {p.abertas.length} aberta{p.abertas.length === 1 ? "" : "s"}
                  {p.clientes > 0
                    ? ` · ${p.clientes} cliente${p.clientes === 1 ? "" : "s"}`
                    : ""}
                  {p.internas > 0 ? ` · ${p.internas} interna${p.internas === 1 ? "" : "s"}` : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <Numero
                valor={p.atrasadas.length}
                rotulo="Em atraso"
                tom={p.atrasadas.length > 0 ? "alerta" : "neutro"}
              />
              <Numero
                valor={p.hojeVence.length}
                rotulo="Vence hoje"
                tom={p.hojeVence.length > 0 ? "atencao" : "neutro"}
              />
              <Numero
                valor={p.semPrazo.length}
                rotulo="Sem prazo"
                tom="neutro"
              />
            </div>

            {p.abertas.length === 0 ? (
              <p className="text-sm text-fysi-muted mt-4">
                Nada aberto no momento.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-1.5 flex-1">
                {[...p.atrasadas, ...p.hojeVence, ...p.proximas]
                  .slice(0, 4)
                  .map((t) => (
                    <li key={t.id}>
                      <ItemDemanda task={t} hoje={hoje} keyParam={keyParam} />
                    </li>
                  ))}
                {p.atrasadas.length + p.hojeVence.length + p.proximas.length === 0 ? (
                  <li className="text-xs text-fysi-muted">
                    Nenhuma demanda com prazo definido.
                  </li>
                ) : null}
              </ul>
            )}

            <Link
              href={`/admin/tarefas${keyParam}`}
              className="mt-4 text-xs font-medium text-fysi-deep hover:underline underline-offset-2"
            >
              Ver tudo de {p.membro.label.split(" ")[0]} →
            </Link>
          </section>
        ))}
      </div>

      <section className="mt-6 bg-white border border-fysi-line rounded-[18px] shadow-fysi-card p-5">
        <h2 className="text-[0.95rem] font-semibold text-fysi-deep mb-3">
          Onde está o trabalho aberto
        </h2>
        <Distribuicao tasks={todas} />
      </section>
    </AdminShell>
  );
}

function Numero({
  valor,
  rotulo,
  tom,
}: {
  valor: number;
  rotulo: string;
  tom: "alerta" | "atencao" | "neutro";
}) {
  const cor =
    tom === "alerta"
      ? "text-red-700"
      : tom === "atencao"
        ? "text-amber-700"
        : "text-fysi-deep";
  return (
    <div className="rounded-[10px] bg-fysi-cream/60 px-2.5 py-2">
      <span className={`block text-lg font-semibold leading-none ${cor}`}>
        {valor}
      </span>
      <span className="block text-[0.65rem] uppercase tracking-[0.08em] text-fysi-muted mt-1">
        {rotulo}
      </span>
    </div>
  );
}

function ItemDemanda({
  task,
  hoje,
  keyParam,
}: {
  task: Task;
  hoje: string;
  keyParam: string;
}) {
  const atrasada = !!task.data_vencimento && task.data_vencimento < hoje;
  const conteudo = (
    <span className="flex items-center gap-2 min-w-0">
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          atrasada ? "bg-red-500" : "bg-fysi-line-strong"
        }`}
      />
      <span className="truncate text-xs text-fysi-deep">{task.titulo}</span>
      {task.data_vencimento ? (
        <span
          className={`ml-auto shrink-0 text-[0.68rem] tabular-nums ${
            atrasada ? "text-red-700 font-semibold" : "text-fysi-muted"
          }`}
        >
          {diaMes(task.data_vencimento)}
        </span>
      ) : null}
    </span>
  );

  if (!task.client_id) {
    return (
      <span className="block rounded-[8px] px-2 py-1" title="Demanda interna">
        {conteudo}
      </span>
    );
  }
  return (
    <Link
      href={`/admin/${task.client_id}?tab=tarefas${keyParam ? `&${keyParam.slice(1)}` : ""}#tarefa-${task.id}`}
      className="block rounded-[8px] px-2 py-1 hover:bg-fysi-cream transition-colors"
      title={task.client?.empresa || task.client?.nome || undefined}
    >
      {conteudo}
    </Link>
  );
}

/** Quanto do trabalho aberto está em cada estágio e em cada área interna. */
function Distribuicao({ tasks }: { tasks: Task[] }) {
  const abertas = tasks.filter((t) => TASK_STATUS_GROUP[t.status] === "ativo");
  const porStatus = TASK_STATUS_OPTIONS.map((o) => ({
    label: o.label,
    n: abertas.filter((t) => t.status === o.value).length,
  })).filter((x) => x.n > 0);
  const porArea = AREAS.map((a) => ({
    label: a.label,
    barra: a.barra,
    n: abertas.filter((t) => t.area === a.value).length,
  })).filter((x) => x.n > 0);
  const total = abertas.length || 1;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-medium mb-2">
          Por estágio
        </p>
        <ul className="flex flex-col gap-1.5">
          {porStatus.map((s) => (
            <li key={s.label} className="flex items-center gap-2.5">
              <span className="w-44 shrink-0 truncate text-xs text-fysi-deep">
                {s.label}
              </span>
              <span className="flex-1 h-2 rounded-full bg-fysi-cream overflow-hidden">
                <span
                  className="block h-full rounded-full bg-fysi-deep/60"
                  style={{ width: `${Math.round((s.n / total) * 100)}%` }}
                />
              </span>
              <span className="w-7 shrink-0 text-right text-xs tabular-nums text-fysi-muted">
                {s.n}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {porArea.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-medium mb-2">
            Áreas internas
          </p>
          <ul className="flex flex-wrap gap-2">
            {porArea.map((a) => (
              <li
                key={a.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-fysi-line bg-white px-2.5 py-1 text-xs text-fysi-deep"
              >
                <span className={`h-2 w-2 rounded-full ${a.barra}`} />
                {a.label}
                <span className="text-fysi-muted tabular-nums">{a.n}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
