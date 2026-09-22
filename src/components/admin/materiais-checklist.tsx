import { Eyebrow } from "@/components/ui/pill";
import { SubmitTextButton } from "@/components/admin/submit-button";
import {
  dataCurtaDoMomento,
  fraseResumo,
  resumirMateriais,
  type MaterialItem,
} from "@/lib/materiais-cliente";
import {
  adicionarMaterialAction,
  conferirMaterialAction,
  editarMaterialAction,
  marcarMaterialAction,
  moverMaterialAction,
  removerMaterialAction,
  semearMateriaisAction,
} from "@/app/admin/[id]/materiais-actions";

/**
 * Lado da EQUIPE de "o que o cliente precisa nos enviar".
 *
 * Server Component de propósito: cada ação é um <form> com Server Action
 * (POST). Nenhuma delas pode ser link/GET — o prefetch do <Link> do Next
 * dispararia a mutação sozinho.
 *
 * Aparece em dois lugares, com os mesmos dados: dentro do painel de Materiais
 * da ficha do cliente e no briefing aberto no admin. É uma lista só; não há
 * segunda lista concorrente em outra aba.
 */

/** Campos que todo form precisa repetir (escopo + pra onde revalidar). */
function Contexto({
  clientId,
  urlKey,
  docId,
}: {
  clientId: string;
  urlKey: string | null;
  docId?: string | null;
}) {
  return (
    <>
      <input type="hidden" name="clientId" value={clientId} />
      {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
      {docId ? <input type="hidden" name="docId" value={docId} /> : null}
    </>
  );
}

function EstadoPill({ item }: { item: MaterialItem }) {
  if (item.status === "nao_se_aplica") {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-fysi-cream text-fysi-muted border border-fysi-line whitespace-nowrap">
        não se aplica
      </span>
    );
  }
  if (item.status === "enviado") {
    return item.conferidoEm ? (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-fysi-mint text-fysi-deep whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-fysi-deep" />
        recebido
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-fysi-yellow text-fysi-deep whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-fysi-deep" />
        a conferir
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      falta
    </span>
  );
}

const BOTAO_DISCRETO =
  "text-xs font-medium text-fysi-deep hover:underline disabled:opacity-40";

export function MateriaisChecklist({
  clientId,
  urlKey,
  docId,
  itens,
}: {
  clientId: string;
  urlKey: string | null;
  /** Briefing aberto no admin — usado só pra revalidar a tela certa. */
  docId?: string | null;
  itens: MaterialItem[];
}) {
  const resumo = resumirMateriais(itens);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Eyebrow>O que o cliente precisa enviar</Eyebrow>
          <p className="text-xs text-fysi-muted mt-1 max-w-xl">
            Com o link público do briefing ligado, o cliente vê esta lista e
            marca o que já mandou. Enquanto ninguém da equipe confere, o item
            fica como “a conferir” — dizer que mandou não é ter chegado.
          </p>
        </div>
        {itens.length > 0 ? (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
              resumo.faltam === 0
                ? "bg-fysi-mint text-fysi-deep"
                : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}
          >
            {fraseResumo(resumo)}
            {resumo.aConferir > 0 ? ` · ${resumo.aConferir} a conferir` : ""}
          </span>
        ) : null}
      </div>

      {itens.length === 0 ? (
        <div className="bg-fysi-cream/50 border border-fysi-line rounded-[12px] p-4 text-center">
          <p className="text-sm text-fysi-deep font-medium">
            Nenhum item na lista ainda
          </p>
          <p className="text-xs text-fysi-muted mt-1 max-w-md mx-auto">
            A lista padrão já traz o que costuma travar projeto: logo em vetor,
            fotos, textos, depoimentos, acesso ao domínio e à hospedagem, CNPJ
            pro rodapé e links das redes. Dá pra editar tudo depois.
          </p>
          <form action={semearMateriaisAction} className="mt-3">
            <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
            <SubmitTextButton
              className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90 disabled:opacity-50"
              pendingLabel="Criando…"
            >
              Usar a lista padrão
            </SubmitTextButton>
          </form>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {itens.map((item, i) => (
            <li
              key={item.id}
              className="bg-white border border-fysi-line rounded-[12px] px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-fysi-deep min-w-0 flex-1">
                  {item.titulo}
                </p>
                <EstadoPill item={item} />
              </div>

              {item.instrucao ? (
                <p className="text-xs text-fysi-muted mt-1">{item.instrucao}</p>
              ) : null}

              {/* O que o cliente escreveu ao marcar — é aqui que aparece
                  "mandei no WhatsApp" ou o link da pasta dele. */}
              {item.recadoDoCliente ? (
                <p className="text-xs text-fysi-deep mt-1.5 bg-fysi-cream/60 border border-fysi-line rounded-[8px] px-2 py-1.5 break-words">
                  <span className="text-fysi-muted">Recado do cliente: </span>
                  {item.recadoDoCliente}
                </p>
              ) : null}

              {item.marcadoEm ? (
                <p className="text-[0.7rem] text-fysi-muted mt-1">
                  {item.marcadoPor === "cliente"
                    ? "O cliente marcou"
                    : `Marcado por ${item.marcadoPor ?? "equipe"}`}{" "}
                  em {dataCurtaDoMomento(item.marcadoEm)}
                  {item.conferidoEm
                    ? ` · conferido por ${item.conferidoPor ?? "equipe"}`
                    : ""}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                {/* Confirmar recebimento: o passo que fecha o item de verdade. */}
                {item.status === "enviado" && !item.conferidoEm ? (
                  <form action={conferirMaterialAction}>
                    <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <SubmitTextButton
                      className="text-xs font-semibold text-fysi-deep hover:underline disabled:opacity-40"
                      pendingLabel="…"
                    >
                      Confirmar que chegou
                    </SubmitTextButton>
                  </form>
                ) : null}

                {item.status !== "enviado" ? (
                  <form action={marcarMaterialAction}>
                    <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="status" value="enviado" />
                    <SubmitTextButton className={BOTAO_DISCRETO} pendingLabel="…">
                      Já recebemos
                    </SubmitTextButton>
                  </form>
                ) : null}

                {item.status !== "pendente" ? (
                  <form action={marcarMaterialAction}>
                    <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="status" value="pendente" />
                    <SubmitTextButton className={BOTAO_DISCRETO} pendingLabel="…">
                      Voltar pra pendente
                    </SubmitTextButton>
                  </form>
                ) : null}

                {item.status !== "nao_se_aplica" ? (
                  <form action={marcarMaterialAction}>
                    <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="status" value="nao_se_aplica" />
                    <SubmitTextButton className={BOTAO_DISCRETO} pendingLabel="…">
                      Não se aplica
                    </SubmitTextButton>
                  </form>
                ) : null}

                {/* div, e não span: <form> é conteúdo de fluxo e o parser do
                    navegador não aceita dentro de conteúdo de frase. */}
                <div className="flex items-center gap-2 ml-auto">
                  <form action={moverMaterialAction}>
                    <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="direcao" value="up" />
                    <button
                      type="submit"
                      disabled={i === 0}
                      title="Subir"
                      aria-label="Subir"
                      className="text-fysi-deep text-xs disabled:opacity-30"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moverMaterialAction}>
                    <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="direcao" value="down" />
                    <button
                      type="submit"
                      disabled={i === itens.length - 1}
                      title="Descer"
                      aria-label="Descer"
                      className="text-fysi-deep text-xs disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </form>
                </div>
                <form action={removerMaterialAction}>
                  <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <SubmitTextButton
                    danger
                    confirm={`Remover “${item.titulo}” da lista deste cliente?`}
                    pendingLabel="…"
                  >
                    Remover
                  </SubmitTextButton>
                </form>
              </div>

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-fysi-muted hover:text-fysi-deep">
                  Editar texto do item
                </summary>
                <form
                  action={editarMaterialAction}
                  className="flex flex-col gap-2 mt-2"
                >
                  <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <input
                    name="titulo"
                    defaultValue={item.titulo}
                    required
                    aria-label="Título do item"
                    className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
                  />
                  <textarea
                    name="instrucao"
                    defaultValue={item.instrucao ?? ""}
                    rows={2}
                    placeholder="O que é, em que formato, pra onde mandar."
                    aria-label="Instrução pro cliente"
                    className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
                  />
                  <SubmitTextButton
                    className="self-start rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3.5 py-1.5 hover:bg-fysi-deep/90 disabled:opacity-50"
                    pendingLabel="Salvando…"
                  >
                    Salvar
                  </SubmitTextButton>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}

      {itens.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-fysi-deep hover:underline">
            + Adicionar item
          </summary>
          <form
            action={adicionarMaterialAction}
            className="flex flex-col gap-2 mt-2 bg-fysi-cream/40 border border-fysi-line rounded-[12px] p-3"
          >
            <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
            <input
              name="titulo"
              required
              placeholder="Ex: Cardápio atualizado em PDF"
              aria-label="Título do item"
              className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
            />
            <textarea
              name="instrucao"
              rows={2}
              placeholder="O que é, em que formato, pra onde mandar."
              aria-label="Instrução pro cliente"
              className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
            />
            <SubmitTextButton
              className="self-start rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3.5 py-1.5 hover:bg-fysi-deep/90 disabled:opacity-50"
              pendingLabel="Adicionando…"
            >
              Adicionar
            </SubmitTextButton>
          </form>
        </details>
      ) : null}
    </div>
  );
}
