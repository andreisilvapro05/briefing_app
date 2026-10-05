import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
  hasFullAccess,
  isAdmin,
  isDeveloper,
  telaInicialDe,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { EIView } from "@/components/admin/ei-view";
import { StatusChanger } from "@/components/admin/status-changer";
import { SubmitButton, SubmitTextButton } from "@/components/admin/submit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { hojeEmBrasilia } from "@/lib/datas";
import {
  MOTIVO_LABEL,
  motivoDeArquivo,
  rotuloDoDia,
  separarLinhas,
  type LinhaDaAta,
} from "@/lib/atas";
import { clientesParaAta, getAta } from "@/lib/atas-server";
import {
  apagarAtaAction,
  arquivarAtaAction,
  puxarClienteAction,
  removerClienteDaAtaAction,
  salvarCabecalhoDaAtaAction,
  salvarObservacaoAction,
} from "../actions";

export const dynamic = "force-dynamic";

/**
 * Uma ata: a reunião de uma data, com VÁRIOS clientes dentro — cada um com
 * o status do projeto e a observação daquele dia — mais o documento de
 * blocos pro texto longo, que é o "google docs, mas melhorado" do pedido
 * (o mesmo editor da EI, do Briefing e da Copy).
 *
 * Karine (05/10): "não é pra ser individual de cada cliente, e sim tudo
 * num documento só, poder puxar todos os clientes dentro de um mesmo
 * documento".
 *
 * O documento salva sozinho pelo `updateEIDocumentAction` (autosave do
 * `EIBlockEditor`); o cabeçalho e as observações têm botão próprio porque
 * são campos de formulário, não blocos.
 */
export default async function AtaPage({
  params,
  searchParams,
}: {
  params: Promise<{ ataId: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { ataId } = await params;
  const sp = await searchParams;
  const urlKey = sp.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  if (isDeveloper(member)) redirect(`${telaInicialDe(member)}${kp}`);

  const visibleIds = await getVisibleClientIds(member);
  const [ata, clientes] = await Promise.all([
    getAta(ataId, visibleIds),
    clientesParaAta(visibleIds),
  ]);
  if (!ata) redirect(`/admin/ata${kp}`);

  const acessoTotal = hasFullAccess(member);
  const hoje = hojeEmBrasilia();
  const { ativas, encerradas } = separarLinhas(ata.linhas);
  const jaNaAta = new Set(ata.linhas.map((l) => l.clientId));
  const disponiveis = clientes.filter((c) => !jaNaAta.has(c.id));

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
      <Link
        href={`/admin/ata${kp}`}
        className="text-sm text-fysi-muted hover:text-fysi-deep inline-block mb-3"
      >
        ← Todas as atas
      </Link>

      {/* ---- Cabeçalho: título e data da reunião ---- */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep truncate">
              {ata.titulo}
            </h1>
            <p className="text-sm text-fysi-muted mt-1">
              {rotuloDoDia(ata.data, hoje)} · {ativas.length}{" "}
              {ativas.length === 1 ? "projeto" : "projetos"}
              {encerradas.length > 0
                ? ` · ${encerradas.length} encerrado${encerradas.length === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          {acessoTotal ? (
            <form
              action={salvarCabecalhoDaAtaAction}
              className="flex flex-wrap items-end gap-2 shrink-0"
            >
              {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
              <input type="hidden" name="ataId" value={ata.id} />
              <input
                type="text"
                name="titulo"
                defaultValue={ata.titulo}
                maxLength={160}
                aria-label="Título da reunião"
                className="w-56 rounded-[10px] border border-fysi-line bg-white px-2.5 py-1.5 text-sm text-fysi-deep"
              />
              <input
                type="date"
                name="dia"
                defaultValue={ata.data}
                aria-label="Data da reunião"
                className="rounded-[10px] border border-fysi-line bg-white px-2.5 py-1.5 text-sm text-fysi-deep"
              />
              <SubmitTextButton pendingLabel="Salvando…">Salvar</SubmitTextButton>
            </form>
          ) : null}
        </div>
      </header>

      {/* ---- Puxar cliente pra dentro da ata ---- */}
      {disponiveis.length > 0 ? (
        <form
          action={puxarClienteAction}
          className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-3 mb-5 flex flex-wrap items-end gap-3"
        >
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <input type="hidden" name="ataId" value={ata.id} />
          <label className="flex flex-col gap-1 min-w-[14rem] flex-1">
            <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
              Puxar cliente pra esta ata
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
              {disponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton size="sm" pendingLabel="Puxando…">
            Puxar
          </SubmitButton>
        </form>
      ) : (
        <p className="text-sm text-fysi-muted bg-white border border-dashed border-fysi-line rounded-[16px] px-4 py-3 mb-5">
          Todos os projetos ativos já estão nesta ata.
        </p>
      )}

      {/* ---- Os clientes da reunião ---- */}
      {ata.linhas.length === 0 ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-8 text-center mb-6">
          <p className="text-fysi-deep font-medium mb-1">Ata ainda vazia</p>
          <p className="text-sm text-fysi-muted max-w-md mx-auto">
            Puxe acima os projetos que entraram nesta reunião. Cada um vira uma
            linha com o status dele e um campo de observação.
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-2 mb-6">
          {ativas.map((l) => (
            <LinhaCliente
              key={l.id}
              linha={l}
              ataId={ata.id}
              urlKey={urlKey}
              podeRemover={acessoTotal}
            />
          ))}
        </ul>
      )}

      {/* Encerrados: saíram da lista principal pelo STATUS, não foram
          apagados. A ata é registro do que foi dito na reunião — apagar a
          linha de um projeto que terminou reescreve o passado. */}
      {encerradas.length > 0 ? (
        <details className="mb-6">
          <summary className="cursor-pointer text-sm text-fysi-muted hover:text-fysi-deep select-none">
            {encerradas.length} projeto{encerradas.length === 1 ? "" : "s"} que
            já encerrou nesta ata
          </summary>
          <ul className="flex flex-col gap-2 mt-2">
            {encerradas.map((l) => (
              <LinhaCliente
                key={l.id}
                linha={l}
                ataId={ata.id}
                urlKey={urlKey}
                podeRemover={acessoTotal}
              />
            ))}
          </ul>
        </details>
      ) : null}

      {/* ---- O documento: "um google docs, mas melhorado" ---- */}
      <EIView
        docId={ata.id}
        urlKey={urlKey}
        initialBlocks={ata.blocks}
        atualizadoAt={ata.atualizadoEm}
      />

      {/* ---- Arquivar e apagar ---- */}
      {acessoTotal ? (
        <section className="mt-6 flex flex-wrap items-center gap-3">
          <form action={arquivarAtaAction}>
            {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
            <input type="hidden" name="ataId" value={ata.id} />
            <input
              type="hidden"
              name="arquivar"
              value={ata.arquivada ? "0" : "1"}
            />
            <SubmitTextButton pendingLabel="Salvando…">
              {ata.arquivada ? "Tirar do arquivo" : "Arquivar esta ata"}
            </SubmitTextButton>
          </form>
          <form action={apagarAtaAction}>
            {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
            <input type="hidden" name="ataId" value={ata.id} />
            <DeleteButton label="Apagar de vez" what={ata.titulo} />
          </form>
        </section>
      ) : null}
    </AdminShell>
  );
}

/**
 * Um cliente dentro da ata: nome, status do projeto (editável aqui — é a
 * troca que faz a linha sair da lista) e a observação da reunião.
 */
function LinhaCliente({
  linha,
  ataId,
  urlKey,
  podeRemover,
}: {
  linha: LinhaDaAta;
  ataId: string;
  urlKey: string | null;
  podeRemover: boolean;
}) {
  const motivo = motivoDeArquivo(linha);
  return (
    <li className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={`/admin/${linha.clientId}${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`}
          className="font-medium text-fysi-deep hover:underline min-w-0 truncate"
        >
          {linha.cliente}
        </Link>
        <div className="shrink-0 max-w-[12rem]">
          <StatusChanger
            clientId={linha.clientId}
            status={linha.statusProjeto}
            urlKey={urlKey ?? undefined}
          />
        </div>
        {motivo ? (
          <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.08em] text-fysi-muted border border-fysi-line rounded-full px-2 py-0.5">
            {MOTIVO_LABEL[motivo]}
          </span>
        ) : null}
        {podeRemover ? (
          <form action={removerClienteDaAtaAction} className="ml-auto shrink-0">
            {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
            <input type="hidden" name="ataId" value={ataId} />
            <input type="hidden" name="linhaId" value={linha.id} />
            <DeleteButton label="Tirar da ata" what={linha.cliente} />
          </form>
        ) : null}
      </div>

      <form
        action={salvarObservacaoAction}
        className="mt-2 flex flex-wrap items-end gap-2"
      >
        {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
        <input type="hidden" name="ataId" value={ataId} />
        <input type="hidden" name="linhaId" value={linha.id} />
        <textarea
          name="observacao"
          defaultValue={linha.observacao ?? ""}
          rows={2}
          maxLength={4000}
          placeholder="O que ficou combinado para este projeto"
          aria-label={`Observação de ${linha.cliente}`}
          className="flex-1 min-w-[16rem] rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
        />
        <SubmitTextButton pendingLabel="Salvando…">Salvar</SubmitTextButton>
      </form>
    </li>
  );
}
