import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
  isAdmin,
  isDeveloper,
  telaInicialDe,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { SubmitButton } from "@/components/admin/submit-button";
import { StatusChanger } from "@/components/admin/status-changer";
import { ViewTabs } from "@/components/admin/view-tabs";
import { hojeEmBrasilia } from "@/lib/datas";
import {
  agruparPorData,
  motivoDeArquivo,
  resumoDaObservacao,
  separarAtas,
  MOTIVO_LABEL,
} from "@/lib/atas";
import { clientesParaAta, listarAtas } from "@/lib/atas-server";
import { criarAtaAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Atas de acompanhamento — a tela do gestor de projetos.
 *
 * Karine (04/10), pelo Andrei: "ter uma parte de ata para o Andrei usar
 * (...) e quando ele muda o status do cliente para finalizado some dali.
 * precisa ter os documentos por datas".
 *
 * A lista é agrupada por DIA, mais recente primeiro — a data é o eixo do
 * pedido, não um detalhe de ordenação. O status de cada linha é o do
 * CLIENTE, editável ali mesmo: mudar pra "Completo | Entregue" tira a ata
 * da aba "Em andamento" na hora, sem apagar nada (ela passa pra "Arquivo").
 */
export default async function AtasPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; ver?: string; erro?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  // O AdminShell também barraria (a seção "ata" não está em
  // SECOES_DESENVOLVEDOR), mas sair antes de consultar o banco evita
  // montar a tela inteira pra depois jogar fora.
  if (isDeveloper(member)) redirect(`${telaInicialDe(member)}${kp}`);

  const visibleIds = await getVisibleClientIds(member);
  const [atas, clientes] = await Promise.all([
    listarAtas(visibleIds),
    clientesParaAta(visibleIds),
  ]);

  const { ativas, arquivadas } = separarAtas(atas);
  const verArquivo = params.ver === "arquivo";
  const lista = verArquivo ? arquivadas : ativas;
  const hoje = hojeEmBrasilia();
  const grupos = agruparPorData(lista, hoje);

  const sep = kp ? "&" : "?";

  return (
    <AdminShell
      active="ata"
      keyParam={kp}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-5">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Atas de acompanhamento
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          O registro de cada reunião de projeto, por data. O status é o do
          projeto — mudar pra concluído tira a ata desta lista e manda pro
          arquivo, sem apagar nada.
        </p>
      </header>

      {params.erro === "criar" ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mb-4">
          Não consegui abrir a ata. Tente de novo em alguns segundos.
        </p>
      ) : null}

      <NovaAta clientes={clientes} urlKey={urlKey} hoje={hoje} />

      <div className="mb-4">
        <ViewTabs
          ariaLabel="Atas em andamento ou no arquivo"
          ativo={verArquivo ? "arquivo" : ""}
          items={[
            {
              value: "",
              label: "Em andamento",
              count: ativas.length,
              href: `/admin/ata${kp}`,
            },
            {
              value: "arquivo",
              label: "Arquivo",
              count: arquivadas.length,
              href: `/admin/ata${kp}${sep}ver=arquivo`,
            },
          ]}
        />
      </div>

      {grupos.length === 0 ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-10 text-center">
          <p className="text-fysi-deep font-medium mb-1">
            {verArquivo ? "Nada no arquivo ainda" : "Nenhuma ata em andamento"}
          </p>
          <p className="text-sm text-fysi-muted max-w-md mx-auto">
            {verArquivo
              ? "Aqui ficam as atas de projeto finalizado, de projeto arquivado e as que alguém tirou da frente à mão."
              : "Escolha um cliente acima pra abrir a primeira ata. Cada reunião vira uma ata com a sua data."}
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map((g) => (
            <section key={g.data}>
              {/* A data é o cabeçalho do grupo, não uma coluna da linha:
                  é por ela que se procura uma ata. */}
              <h2 className="text-xs uppercase tracking-[0.12em] text-fysi-muted font-semibold mb-2 flex items-center gap-2">
                {g.rotulo}
                <span className="h-px flex-1 bg-fysi-line" aria-hidden />
                <span className="tabular-nums normal-case tracking-normal font-normal">
                  {g.atas.length}
                </span>
              </h2>
              <ul className="flex flex-col gap-2">
                {g.atas.map((a) => {
                  const motivo = motivoDeArquivo(a);
                  return (
                    <li
                      key={a.id}
                      className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <Link
                          href={`/admin/ata/${a.id}${kp}`}
                          className="font-medium text-fysi-deep hover:underline min-w-0 truncate"
                        >
                          {a.cliente}
                        </Link>
                        {/* O status do PROJETO, editável aqui: é a troca
                            que faz a ata sair da lista, e pedir pra abrir
                            outra tela pra isso é o caminho mais longo. */}
                        <div className="shrink-0 max-w-[12rem]">
                          <StatusChanger
                            clientId={a.clientId}
                            status={a.statusProjeto}
                            urlKey={urlKey ?? undefined}
                          />
                        </div>
                        {motivo ? (
                          <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.08em] text-fysi-muted border border-fysi-line rounded-full px-2 py-0.5">
                            {MOTIVO_LABEL[motivo]}
                          </span>
                        ) : null}
                        <Link
                          href={`/admin/ata/${a.id}${kp}`}
                          className="ml-auto shrink-0 text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
                        >
                          abrir ata →
                        </Link>
                      </div>
                      {a.observacao ? (
                        <p className="text-sm text-fysi-muted mt-1.5">
                          {resumoDaObservacao(a.observacao)}
                        </p>
                      ) : (
                        <p className="text-sm text-fysi-muted/70 mt-1.5 italic">
                          Sem observação.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

/**
 * Abrir uma ata nova. Fica no topo e sempre aberta (não atrás de um
 * "+ Nova"): é a ação da tela, e a ata costuma ser escrita durante ou
 * logo depois da reunião — um clique a menos importa aí.
 *
 * O `SubmitButton` (useFormStatus) é filho do `<form>`, como manda o
 * padrão do projeto: é o que desabilita o botão e evita a ata duplicada
 * por clique duplo.
 */
function NovaAta({
  clientes,
  urlKey,
  hoje,
}: {
  clientes: { id: string; label: string }[];
  urlKey: string | null;
  hoje: string;
}) {
  if (clientes.length === 0) {
    return (
      <p className="text-sm text-fysi-muted bg-white border border-dashed border-fysi-line rounded-[16px] px-4 py-3 mb-5">
        Nenhum projeto ativo pra abrir ata. Projeto arquivado não recebe ata
        nova.
      </p>
    );
  }

  return (
    <form
      action={criarAtaAction}
      className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-4 mb-5 flex flex-wrap items-end gap-3"
    >
      {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
      <label className="flex flex-col gap-1 min-w-[12rem] flex-1">
        <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
          Cliente
        </span>
        <select
          name="clientId"
          required
          defaultValue=""
          className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
        >
          <option value="" disabled>
            Escolha o projeto…
          </option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
          Data
        </span>
        {/* Começa em hoje: a ata quase sempre é da reunião que acabou. */}
        <input
          type="date"
          name="data"
          defaultValue={hoje}
          className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
        />
      </label>
      <label className="flex flex-col gap-1 min-w-[14rem] flex-[2]">
        <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
          Observação (opcional)
        </span>
        <input
          type="text"
          name="observacao"
          maxLength={2000}
          placeholder="O que ficou combinado, em uma linha"
          className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
        />
      </label>
      <SubmitButton size="sm" pendingLabel="Abrindo…">
        Abrir ata
      </SubmitButton>
    </form>
  );
}
