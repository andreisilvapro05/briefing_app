import { Eyebrow } from "@/components/ui/pill";
import { SubmitTextButton } from "@/components/admin/submit-button";
import { FormMaterial } from "@/components/admin/form-material";
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

      {/* Lista padrão E item próprio, lado a lado. Antes o vazio só
          oferecia a lista padrão e o "+ Adicionar item" só existia depois
          de ela existir: quem queria pedir UMA coisa específica tinha que
          criar oito e apagar sete (Karine, 01/10: "preciso poder colocar o
          que o cliente precisa enviar"). */}
      {itens.length === 0 ? (
        <div className="bg-fysi-cream/50 border border-fysi-line rounded-[12px] p-4">
          <p className="text-sm text-fysi-deep font-medium">
            Nenhum item na lista ainda
          </p>
          <p className="text-xs text-fysi-muted mt-1 max-w-xl">
            A lista padrão já traz o que costuma travar projeto: logo em vetor,
            fotos, textos, depoimentos, acesso ao domínio e à hospedagem, CNPJ
            pro rodapé e links das redes. Dá pra editar tudo depois.
          </p>
          <FormMaterial acao={semearMateriaisAction} className="mt-3">
            <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
            <SubmitTextButton
              className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90 disabled:opacity-50"
              pendingLabel="Criando…"
            >
              Usar a lista padrão
            </SubmitTextButton>
          </FormMaterial>
        </div>
      ) : (
        /* Um item por LINHA, como um checklist de documento — antes cada
           item era um cartão com seis botões à mostra, e dez itens viravam
           uma parede (Karine, 01/10: "precisa ser mais simples, tipo um doc
           com checklist"). O que decide fica à vista; o resto, recolhido. */
        <ul className="divide-y divide-fysi-line border-y border-fysi-line">
          {itens.map((item, i) => (
            <li key={item.id} className="py-2">
              <div className="flex items-start gap-2.5">
                <MarcaDeEstado item={item} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={`text-sm font-medium ${
                        item.status === "nao_se_aplica"
                          ? "text-fysi-muted line-through"
                          : "text-fysi-deep"
                      }`}
                    >
                      {item.titulo}
                    </span>
                    <EstadoPill item={item} />
                  </div>

                  {item.instrucao ? (
                    <p className="text-xs text-fysi-muted mt-0.5">
                      {item.instrucao}
                    </p>
                  ) : null}

                  {/* O que o cliente escreveu ao marcar — é aqui que
                      aparece "mandei no WhatsApp" ou o link da pasta. */}
                  {item.recadoDoCliente ? (
                    <p className="text-xs text-fysi-deep mt-1 bg-fysi-cream/60 border border-fysi-line rounded-[8px] px-2 py-1 break-words">
                      <span className="text-fysi-muted">Recado do cliente: </span>
                      {item.recadoDoCliente}
                    </p>
                  ) : null}

                  {item.marcadoEm ? (
                    <p className="text-[0.7rem] text-fysi-muted mt-0.5">
                      {item.marcadoPor === "cliente"
                        ? "O cliente marcou"
                        : `Marcado por ${item.marcadoPor ?? "equipe"}`}{" "}
                      em {dataCurtaDoMomento(item.marcadoEm)}
                      {item.conferidoEm
                        ? ` · conferido por ${item.conferidoPor ?? "equipe"}`
                        : ""}
                    </p>
                  ) : null}
                </div>

                {/* A ação que DECIDE fica à vista. As outras, no "⋯". */}
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === "enviado" && !item.conferidoEm ? (
                    <FormMaterial acao={conferirMaterialAction}>
                      <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <SubmitTextButton
                        className="text-xs font-semibold text-fysi-deep hover:underline disabled:opacity-40 whitespace-nowrap"
                        pendingLabel="…"
                      >
                        Confirmar que chegou
                      </SubmitTextButton>
                    </FormMaterial>
                  ) : item.status === "pendente" ? (
                    <FormMaterial acao={marcarMaterialAction}>
                      <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="status" value="enviado" />
                      <SubmitTextButton
                        className={`${BOTAO_DISCRETO} whitespace-nowrap`}
                        pendingLabel="…"
                      >
                        Já recebemos
                      </SubmitTextButton>
                    </FormMaterial>
                  ) : null}

                  <details className="relative">
                    <summary
                      className="cursor-pointer list-none text-fysi-muted hover:text-fysi-deep px-1 select-none"
                      title="Mais opções"
                      aria-label="Mais opções"
                    >
                      ⋯
                    </summary>
                    <div className="mt-1 flex flex-col gap-2 rounded-[12px] border border-fysi-line bg-white p-3 shadow-fysi-card">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {item.status !== "pendente" ? (
                          <FormMaterial acao={marcarMaterialAction}>
                            <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="status" value="pendente" />
                            <SubmitTextButton className={BOTAO_DISCRETO} pendingLabel="…">
                              Voltar pra pendente
                            </SubmitTextButton>
                          </FormMaterial>
                        ) : null}
                        {item.status !== "nao_se_aplica" ? (
                          <FormMaterial acao={marcarMaterialAction}>
                            <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="status" value="nao_se_aplica" />
                            <SubmitTextButton className={BOTAO_DISCRETO} pendingLabel="…">
                              Não se aplica
                            </SubmitTextButton>
                          </FormMaterial>
                        ) : null}
                        {/* div, e não span: <form> é conteúdo de fluxo e o
                            parser do navegador não aceita dentro de frase. */}
                        <div className="flex items-center gap-2">
                          <FormMaterial acao={moverMaterialAction}>
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
                          </FormMaterial>
                          <FormMaterial acao={moverMaterialAction}>
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
                          </FormMaterial>
                        </div>
                        <FormMaterial acao={removerMaterialAction}>
                          <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <SubmitTextButton
                            danger
                            confirm={`Remover “${item.titulo}” da lista deste cliente?`}
                            pendingLabel="…"
                          >
                            Remover
                          </SubmitTextButton>
                        </FormMaterial>
                      </div>

                      <FormMaterial
                        acao={editarMaterialAction}
                        className="flex flex-col gap-2 border-t border-fysi-line pt-2"
                      >
                        <Contexto clientId={clientId} urlKey={urlKey} docId={docId} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input
                          name="titulo"
                          defaultValue={item.titulo}
                          required
                          aria-label="Título do item"
                          className="border border-fysi-line rounded-[10px] px-3 py-1.5 bg-white text-sm text-fysi-deep"
                        />
                        <textarea
                          name="instrucao"
                          defaultValue={item.instrucao ?? ""}
                          rows={2}
                          placeholder="O que é, em que formato, pra onde mandar."
                          aria-label="Instrução pro cliente"
                          className="border border-fysi-line rounded-[10px] px-3 py-1.5 bg-white text-sm text-fysi-deep"
                        />
                        <SubmitTextButton
                          className="self-start rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3.5 py-1.5 hover:bg-fysi-deep/90 disabled:opacity-50"
                          pendingLabel="Salvando…"
                        >
                          Salvar
                        </SubmitTextButton>
                      </FormMaterial>
                    </div>
                  </details>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Sempre disponível, com ou sem lista — é o pedido dela. */}
      <details>
        <summary className="cursor-pointer text-xs font-medium text-fysi-deep hover:underline">
          + Adicionar item
        </summary>
        <FormMaterial
          acao={adicionarMaterialAction}
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
        </FormMaterial>
      </details>
    </div>
  );
}

/**
 * A marca de estado à esquerda — é o que faz a lista LER como checklist.
 * Quadradinho vazio, meio-marcado (chegou mas ninguém conferiu) e marcado.
 */
function MarcaDeEstado({ item }: { item: MaterialItem }) {
  const base =
    "mt-0.5 h-4 w-4 shrink-0 rounded-[5px] border grid place-items-center text-[0.6rem] font-bold";
  if (item.status === "nao_se_aplica") {
    return (
      <span className={`${base} border-fysi-line text-fysi-muted`} aria-hidden>
        –
      </span>
    );
  }
  if (item.status === "enviado") {
    return item.conferidoEm ? (
      <span
        className={`${base} border-fysi-deep bg-fysi-deep text-fysi-cream`}
        aria-hidden
      >
        ✓
      </span>
    ) : (
      <span
        className={`${base} border-fysi-yellow bg-fysi-yellow/40 text-fysi-deep`}
        aria-hidden
      >
        ✓
      </span>
    );
  }
  return <span className={`${base} border-fysi-line`} aria-hidden />;
}
