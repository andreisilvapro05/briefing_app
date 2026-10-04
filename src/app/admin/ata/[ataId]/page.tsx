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
  ordenarPorData,
  rotuloDoDia,
  type AtaResumo,
} from "@/lib/atas";
import { getAta, listarAtas } from "@/lib/atas-server";
import {
  apagarAtaAction,
  arquivarAtaAction,
  salvarCabecalhoDaAtaAction,
} from "../actions";

export const dynamic = "force-dynamic";

/**
 * Uma ata: cliente, status do projeto, observação curta, e o documento de
 * blocos pro texto longo — o "google docs, mas melhorado" do pedido, que é
 * o mesmo editor (BlockNote) da EI, do Briefing e da Copy.
 *
 * O documento salva sozinho pelo `updateEIDocumentAction` (autosave do
 * `EIBlockEditor`); o cabeçalho tem botão próprio porque data e observação
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
  const [ata, todas] = await Promise.all([getAta(ataId), listarAtas(visibleIds)]);

  // Id que não é ata (os cinco tipos dividem a tabela) ou que não existe.
  if (!ata) redirect(`/admin/ata${kp}`);
  /**
   * Escopo por cliente na LEITURA também, não só nas escritas: sem isto,
   * quem só vê os próprios projetos abriria a ata de qualquer outro
   * digitando o id na URL. `visibleIds` nulo = acesso total.
   */
  if (visibleIds && !visibleIds.has(ata.clientId)) redirect(`/admin/ata${kp}`);

  const hoje = hojeEmBrasilia();
  const motivo = motivoDeArquivo(ata);
  const doCliente = ordenarPorData(
    todas.filter((a) => a.clientId === ata.clientId)
  );
  const podeApagar = hasFullAccess(member);

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
      <div className="flex -mx-4 md:-mx-6 lg:-mx-8 -my-6 h-[calc(100vh-3.5rem)]">
        <AtasDoCliente
          atas={doCliente}
          ativaId={ata.id}
          cliente={ata.cliente}
          keyParam={kp}
          hoje={hoje}
        />

        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          <header className="mb-4">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <Link
                href={`/admin/${ata.clientId}${kp}`}
                className="text-[1.4rem] leading-tight font-semibold tracking-tight text-fysi-deep hover:underline min-w-0 truncate"
                title="Abrir a ficha do projeto"
              >
                {ata.cliente}
              </Link>
              {/* O status é o do PROJETO, não um campo da ata — por isso
                  escreve em clients.status e aparece igual em toda tela
                  que mostra este projeto. */}
              <div className="shrink-0 max-w-[14rem]">
                <StatusChanger
                  clientId={ata.clientId}
                  status={ata.statusProjeto}
                  urlKey={urlKey ?? undefined}
                />
              </div>
            </div>
            <p className="text-xs text-fysi-muted">
              Ata de {rotuloDoDia(ata.data, hoje).toLowerCase()} ·{" "}
              {doCliente.length === 1
                ? "única ata deste projeto"
                : `${doCliente.length} atas deste projeto`}
            </p>
          </header>

          {motivo ? (
            <p className="text-sm text-fysi-deep bg-fysi-cream border border-fysi-line rounded-[12px] px-4 py-3 mb-4">
              <strong className="font-semibold">{MOTIVO_LABEL[motivo]}.</strong>{" "}
              {motivo === "finalizado"
                ? "Esta ata saiu da lista de atas em andamento e está no arquivo. Nada foi apagado — voltar o status do projeto a traz de volta."
                : motivo === "projeto-arquivado"
                  ? "O projeto foi arquivado, então as atas dele ficam no arquivo."
                  : "Alguém tirou esta ata da lista principal. Dá pra devolvê-la a qualquer momento."}
            </p>
          ) : null}

          <Cabecalho ata={ata} urlKey={urlKey} />

          {/* O documento de blocos. Mesmo componente dos outros hubs: o
              autosave, o "Copiar MD" e o tema claro vêm de graça, e um
              defeito do BlockNote se conserta num lugar só. */}
          <EIView
            docId={ata.id}
            urlKey={urlKey}
            initialBlocks={ata.blocks}
            atualizadoAt={ata.atualizadoEm}
          />

          <div className="flex flex-wrap items-center gap-4 pb-6">
            <form action={arquivarAtaAction}>
              <input type="hidden" name="ataId" value={ata.id} />
              <input
                type="hidden"
                name="arquivar"
                value={ata.arquivada ? "0" : "1"}
              />
              {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
              <SubmitTextButton
                pendingLabel="…"
                confirm={
                  ata.arquivada
                    ? undefined
                    : "Tirar esta ata da lista principal? Ela fica no arquivo e dá pra voltar."
                }
              >
                {ata.arquivada ? "Devolver à lista" : "Arquivar esta ata"}
              </SubmitTextButton>
            </form>
            {podeApagar ? (
              <form action={apagarAtaAction} className="flex items-center gap-2">
                <input type="hidden" name="ataId" value={ata.id} />
                {urlKey ? (
                  <input type="hidden" name="key" value={urlKey} />
                ) : null}
                <span className="text-xs text-fysi-muted">
                  Criada no cliente errado?
                </span>
                <DeleteButton
                  what={`a ata de ${ata.cliente} de ${rotuloDoDia(ata.data, hoje).toLowerCase()}`}
                  label="Apagar"
                />
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

/**
 * Data e observação curta. Um formulário só, com um botão só: são o
 * cabeçalho do mesmo registro, e dois "Salvar" vizinhos fazem a pessoa
 * salvar um e esquecer o outro.
 */
function Cabecalho({ ata, urlKey }: { ata: AtaResumo; urlKey: string | null }) {
  return (
    <form
      action={salvarCabecalhoDaAtaAction}
      className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-6"
    >
      <input type="hidden" name="ataId" value={ata.id} />
      {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
            Data da ata
          </span>
          <input
            type="date"
            name="data"
            defaultValue={ata.data}
            className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
          />
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-[16rem]">
          <span className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-semibold">
            Observação
          </span>
          <textarea
            name="observacao"
            rows={2}
            maxLength={2000}
            defaultValue={ata.observacao ?? ""}
            placeholder="O resumo que se lê na lista sem abrir a ata"
            className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep resize-y"
          />
        </label>
      </div>
      <div className="mt-3">
        <SubmitButton size="sm" variant="secondary" pendingLabel="Salvando…">
          Salvar cabeçalho
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * As atas DESTE cliente, por data — "precisa ter os documentos por datas",
 * aplicado ao projeto que está aberto. É aqui que se vê que a ata de hoje
 * não substituiu a da semana passada.
 */
function AtasDoCliente({
  atas,
  ativaId,
  cliente,
  keyParam,
  hoje,
}: {
  atas: AtaResumo[];
  ativaId: string;
  cliente: string;
  keyParam: string;
  hoje: string;
}) {
  return (
    <aside className="hidden lg:flex w-[260px] shrink-0 border-r border-fysi-line bg-white flex-col h-full">
      <div className="p-3 border-b border-fysi-line">
        <Link
          href={`/admin/ata${keyParam}`}
          className="text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
        >
          ← Todas as atas
        </Link>
        <p className="text-sm font-semibold text-fysi-deep mt-2 truncate" title={cliente}>
          {cliente}
        </p>
        <p className="text-xs text-fysi-muted">
          {atas.length} {atas.length === 1 ? "ata" : "atas"}
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {atas.map((a) => {
          const motivo = motivoDeArquivo(a);
          const ativa = a.id === ativaId;
          return (
            <Link
              key={a.id}
              href={`/admin/ata/${a.id}${keyParam}`}
              aria-current={ativa ? "page" : undefined}
              className={`block px-3 py-2 text-sm border-l-2 ${
                ativa
                  ? "bg-fysi-mint/40 border-fysi-deep text-fysi-deep font-medium"
                  : "border-transparent text-fysi-muted hover:bg-fysi-cream/60 hover:text-fysi-deep"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="truncate">{rotuloDoDia(a.data, hoje)}</span>
                {motivo ? (
                  <span
                    className="shrink-0 text-[0.6rem] uppercase tracking-[0.08em] text-fysi-muted/80"
                    title={MOTIVO_LABEL[motivo]}
                  >
                    arquivo
                  </span>
                ) : null}
              </span>
              {a.observacao ? (
                <span className="block text-xs text-fysi-muted/80 truncate mt-0.5">
                  {a.observacao}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
