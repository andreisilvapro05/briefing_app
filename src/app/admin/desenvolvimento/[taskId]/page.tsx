import { redirect } from "next/navigation";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { AdminShell } from "@/components/admin/admin-shell";
import { AutoSubmitSelect } from "@/components/admin/auto-submit-select";
import { SubmitButton } from "@/components/admin/submit-button";
import { FichaImplementacaoPainel } from "@/components/admin/ficha-implementacao";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
  hasTaskScopedRole,
  isAdmin,
  isDeveloper,
} from "@/lib/member";
import {
  getFichaDoCliente,
  getTarefaComCliente,
} from "@/lib/ficha-implementacao-server";
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
} from "@/lib/project-tasks";
import { formatDataCompleta } from "@/lib/datas";
import { atualizarMinhaTarefaAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * A ficha de trabalho de UMA tarefa: tudo que quem implementa precisa pra
 * montar aquela página, num lugar só.
 *
 * Três guardas de servidor, nesta ordem (a primeira que falha manda embora):
 *   1. a tarefa existe e tem cliente;
 *   2. o cliente está no escopo do papel (getVisibleClientIds — pra
 *      "desenvolvedor" e "basico" isso é "os clientes em que ele tem
 *      tarefa"); e
 *   3. a tarefa é DELE, quando o papel é restrito por tarefa.
 *
 * A terceira é o que separa esta tela do resto do app: ver o cliente não
 * basta pra ver a senha da hospedagem dele — é preciso estar escalado
 * naquela tarefa. Nenhuma delas depende do que o navegador mandou: a tarefa
 * e o cliente são lidos do banco pelo id da URL.
 */
export default async function TarefaDeImplementacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { taskId } = await params;
  const sp = await searchParams;
  const urlKey = sp.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const voltar = `/admin/desenvolvimento${keyParam}`;

  // Tarefa inexistente sai pelo MESMO caminho de tarefa fora do alcance: um
  // 404 distinguível de um redirect diria a quem enumerasse ids quais
  // existem. Não é grande coisa, mas não custa nada não contar.
  const tarefa = await getTarefaComCliente(taskId);
  if (!tarefa) redirect(voltar);
  // Demanda interna da agência não tem página pra implementar — e como não
  // tem cliente, não há escopo pra checar. Fora daqui.
  if (!tarefa.client_id) redirect(voltar);

  const visibleIds = await getVisibleClientIds(member);
  if (visibleIds && !visibleIds.has(tarefa.client_id)) redirect(voltar);

  const restrito = hasTaskScopedRole(member);
  if (restrito && (!member.taskValue || tarefa.responsavel !== member.taskValue)) {
    redirect(voltar);
  }

  // Quem implementa LÊ a ficha; quem preenche é a equipe. Separar as duas
  // coisas é o que mantém a credencial rastreável: se o valor da senha só
  // muda por quem tem acesso total, uma senha errada aqui tem um dono
  // conhecido. A guarda de verdade está em autorizarEscrita(), na action —
  // esta linha só evita mostrar um formulário que o servidor recusaria.
  const podeEditarFicha = !isDeveloper(member);
  const ficha = await getFichaDoCliente(tarefa.client_id);
  const prioridade = TASK_PRIORITY_OPTIONS.find(
    (p) => p.value === (tarefa.prioridade ?? "")
  );

  return (
    <AdminShell
      active="desenvolvimento"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
      hideFinance={!hasFinanceAccess(member)}
    >
      <Link
        href={voltar}
        className="text-sm text-fysi-muted hover:text-fysi-deep inline-block mb-3"
      >
        ← Minhas tarefas
      </Link>

      <header className="mb-5">
        <p className="text-sm text-fysi-muted">{tarefa.clienteNome}</p>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          {tarefa.titulo}
        </h1>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.72rem] font-medium ${TASK_STATUS_TONE[tarefa.status]}`}
          >
            {TASK_STATUS_OPTIONS.find((o) => o.value === tarefa.status)?.label ??
              tarefa.status}
          </span>
          {tarefa.data_vencimento ? (
            <Pill tone="outline">
              Prazo: {formatDataCompleta(tarefa.data_vencimento)}
            </Pill>
          ) : (
            <Pill tone="muted">sem prazo</Pill>
          )}
          {prioridade?.value ? (
            <Pill tone="yellow">{prioridade.label}</Pill>
          ) : null}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="min-w-0">
          <h2 className="text-[0.8rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold mb-2">
            Pra implementar esta página
          </h2>
          {ficha ? (
            <FichaImplementacaoPainel
              ficha={ficha}
              podeEditar={podeEditarFicha}
              urlKey={urlKey}
              voltarPara={`/admin/desenvolvimento/${taskId}`}
            />
          ) : (
            <section className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-6">
              <p className="text-fysi-deep font-medium mb-1">
                {tarefa.clienteNome} ainda não tem Estrutura Inicial
              </p>
              <p className="text-sm text-fysi-muted">
                A ficha de implementação (acessos, Figma, links de botão e
                pixel) fica na Estrutura Inicial do projeto.{" "}
                {isDeveloper(member)
                  ? "Peça pra equipe criar a EI deste cliente."
                  : "Crie a Estrutura Inicial do cliente pra poder preencher."}
              </p>
            </section>
          )}
        </div>

        {/* ---- Minha tarefa: o pouco que quem implementa escreve ---- */}
        <aside className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-5">
          <h2 className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold">
            Minha tarefa
          </h2>

          <form action={atualizarMinhaTarefaAction} className="mt-3">
            <input type="hidden" name="taskId" value={taskId} />
            {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
            <label className="block text-xs text-fysi-muted mb-1">Status</label>
            <AutoSubmitSelect
              name="status"
              defaultValue={tarefa.status}
              className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep"
            >
              {TASK_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>

          <form action={atualizarMinhaTarefaAction} className="mt-4">
            <input type="hidden" name="taskId" value={taskId} />
            {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
            <label
              htmlFor="observacoes"
              className="block text-xs text-fysi-muted mb-1"
            >
              Observações
            </label>
            <textarea
              id="observacoes"
              name="observacoes"
              rows={6}
              defaultValue={tarefa.observacoes ?? ""}
              placeholder="O que ficou pendente, o que você mudou, o que precisa conferir."
              className="w-full rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep placeholder:text-fysi-muted/70 focus:outline-none focus:border-fysi-deep"
            />
            <div className="mt-2">
              <SubmitButton size="sm">Salvar observações</SubmitButton>
            </div>
          </form>

          {isDeveloper(member) ? (
            <p className="text-[0.7rem] text-fysi-muted mt-4 border-t border-fysi-line pt-3">
              Os dados da página (acessos, Figma, botões, pixel) são
              preenchidos pela equipe. Se faltar alguma coisa, avise quem te
              passou a tarefa.
            </p>
          ) : null}
        </aside>
      </div>
    </AdminShell>
  );
}
