import { Eyebrow } from "@/components/ui/pill";
import { SubmitTextButton } from "@/components/admin/submit-button";
import { marcarMaterialClienteAction } from "@/app/b/[token]/actions";
import {
  dataCurtaDoMomento,
  resumirMateriais,
  type MaterialItem,
} from "@/lib/materiais-cliente";

/**
 * Lado do CLIENTE de "o que você precisa nos enviar", dentro do link público
 * do briefing.
 *
 * Aqui não há login: o que autoriza é o token da URL, reconferido dentro da
 * Server Action. O formulário não manda id de cliente — se mandasse, bastaria
 * trocar o campo pra escrever na lista de outro cliente.
 *
 * Marcar "já enviei" é uma declaração do cliente, não um recebimento: a
 * equipe confirma depois. É por isso que o item marcado continua aparecendo
 * como "a gente ainda vai conferir" em vez de sumir da lista.
 */
export function MateriaisDoCliente({
  token,
  itens,
}: {
  token: string;
  itens: MaterialItem[];
}) {
  if (itens.length === 0) return null;
  const resumo = resumirMateriais(itens);
  const tudoFeito = resumo.faltam === 0;

  return (
    <section className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-10 mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <Eyebrow>O que falta você nos enviar</Eyebrow>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
            tudoFeito
              ? "bg-fysi-mint text-fysi-deep"
              : "bg-fysi-yellow text-fysi-deep"
          }`}
        >
          {tudoFeito
            ? "Você já mandou tudo"
            : `${resumo.faltam === 1 ? "falta 1 item" : `faltam ${resumo.faltam} itens`} de ${resumo.total}`}
        </span>
      </div>
      <p className="text-sm text-fysi-muted mb-5 max-w-2xl">
        {tudoFeito
          ? "Nada pendente por aqui. Se aparecer algo novo, a gente acrescenta nesta lista e você vê no mesmo link."
          : "São os materiais que só você pode nos passar — é o que costuma segurar o projeto. Mande pelo mesmo canal em que você fala com a gente e marque aqui o que já enviou."}
      </p>

      <ul className="flex flex-col gap-3">
        {itens.map((item) => {
          const enviado = item.status === "enviado";
          const naoSeAplica = item.status === "nao_se_aplica";
          return (
            <li
              key={item.id}
              className={`rounded-[16px] border p-4 ${
                enviado
                  ? "bg-fysi-mint/30 border-fysi-mint-vivid/40"
                  : naoSeAplica
                    ? "bg-fysi-cream/50 border-fysi-line"
                    : "bg-white border-fysi-line"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-1 h-4 w-4 shrink-0 rounded-[5px] border flex items-center justify-center text-[0.65rem] font-bold ${
                    enviado
                      ? "bg-fysi-deep border-fysi-deep text-fysi-cream"
                      : "bg-white border-fysi-line-strong text-transparent"
                  }`}
                >
                  ✓
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      naoSeAplica
                        ? "text-fysi-muted line-through"
                        : "text-fysi-deep"
                    }`}
                  >
                    {item.titulo}
                  </p>
                  {item.instrucao && !naoSeAplica ? (
                    <p className="text-sm text-fysi-muted mt-1">
                      {item.instrucao}
                    </p>
                  ) : null}

                  {enviado ? (
                    <p className="text-xs text-fysi-deep mt-2">
                      {item.conferidoEm
                        ? "Recebido pela Fysi. Nada a fazer aqui."
                        : `Você marcou como enviado${
                            item.marcadoEm
                              ? ` em ${dataCurtaDoMomento(item.marcadoEm)}`
                              : ""
                          }. A gente confere e avisa se faltar algo.`}
                    </p>
                  ) : null}

                  {item.recadoDoCliente ? (
                    <p className="text-xs text-fysi-muted mt-1 break-words">
                      Seu recado: {item.recadoDoCliente}
                    </p>
                  ) : null}

                  {/* Ações. Cada uma é um form próprio (POST) — link com
                      efeito não serve: o Next faz prefetch e dispararia
                      sozinho. */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                    {!enviado ? (
                      <form
                        action={marcarMaterialClienteAction}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="status" value="enviado" />
                        <input
                          name="recado"
                          maxLength={500}
                          placeholder="Onde você mandou? (opcional)"
                          aria-label={`Onde você mandou ${item.titulo}`}
                          className="border border-fysi-line rounded-[10px] px-3 py-1.5 bg-white text-sm text-fysi-deep w-full sm:w-64"
                        />
                        <SubmitTextButton
                          className="rounded-full bg-fysi-deep text-fysi-cream text-xs font-semibold px-4 py-2 hover:bg-fysi-deep/90 disabled:opacity-50"
                          pendingLabel="Marcando…"
                          savedLabel="Marcado ✓"
                        >
                          Já enviei
                        </SubmitTextButton>
                      </form>
                    ) : (
                      <form action={marcarMaterialClienteAction}>
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="status" value="pendente" />
                        <SubmitTextButton
                          className="text-xs font-medium text-fysi-deep hover:underline disabled:opacity-50"
                          pendingLabel="…"
                        >
                          Na verdade, ainda não enviei
                        </SubmitTextButton>
                      </form>
                    )}

                    {!enviado ? (
                      <form action={marcarMaterialClienteAction}>
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={naoSeAplica ? "pendente" : "nao_se_aplica"}
                        />
                        <SubmitTextButton
                          className="text-xs font-medium text-fysi-muted hover:text-fysi-deep hover:underline disabled:opacity-50"
                          pendingLabel="…"
                        >
                          {naoSeAplica
                            ? "Ainda preciso enviar isso"
                            : "Não tenho / não se aplica"}
                        </SubmitTextButton>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
