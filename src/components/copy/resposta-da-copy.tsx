"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  responderCopyAction,
  type RespostaState,
} from "@/app/copy/[token]/actions";
import type { SituacaoCopy } from "@/lib/copy-documento";

/**
 * Onde o cliente responde: aprova, ou diz o que mudar.
 *
 * Dois caminhos no mesmo formulário, e o de ajuste exige escrever o quê —
 * "não gostei" sem detalhe devolve o trabalho pra equipe adivinhar, que é
 * o que acontece hoje no WhatsApp.
 */
export function RespostaDaCopy({
  token,
  jaRespondeu,
  situacao,
  comentario,
}: {
  token: string;
  jaRespondeu: boolean;
  situacao: SituacaoCopy;
  comentario: string | null;
}) {
  const [estado, enviar] = useActionState<RespostaState, FormData>(
    responderCopyAction,
    {}
  );
  const [resposta, setResposta] = useState<"aprovar" | "ajuste" | "">("");

  if (estado.ok || jaRespondeu) {
    const aprovada = estado.ok ? resposta === "aprovar" : situacao === "aprovada";
    return (
      <section
        className={`rounded-[20px] border p-6 ${
          aprovada
            ? "border-fysi-mint-vivid/40 bg-fysi-mint/30"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <p className="font-semibold text-fysi-deep">
          {aprovada ? "Copy aprovada." : "Pedido de ajuste recebido."}
        </p>
        <p className="text-sm text-fysi-deep/80 mt-1">
          {aprovada
            ? "Obrigado. Seguimos para o design da página."
            : "A equipe já foi avisada e vai te mandar a versão ajustada."}
        </p>
        {comentario ? (
          <p className="text-sm text-fysi-deep/70 mt-3 border-t border-fysi-deep/10 pt-3">
            <span className="font-medium">O que você escreveu:</span>{" "}
            {comentario}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <form
      action={enviar}
      className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6"
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="resposta" value={resposta} />

      <p className="font-semibold text-fysi-deep mb-3">O que você achou?</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setResposta("aprovar")}
          aria-pressed={resposta === "aprovar"}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
            resposta === "aprovar"
              ? "border-fysi-deep bg-fysi-deep text-fysi-cream"
              : "border-fysi-line bg-white text-fysi-deep hover:border-fysi-deep/40"
          }`}
        >
          Está aprovada
        </button>
        <button
          type="button"
          onClick={() => setResposta("ajuste")}
          aria-pressed={resposta === "ajuste"}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
            resposta === "ajuste"
              ? "border-fysi-deep bg-fysi-deep text-fysi-cream"
              : "border-fysi-line bg-white text-fysi-deep hover:border-fysi-deep/40"
          }`}
        >
          Preciso de um ajuste
        </button>
      </div>

      <label className="block">
        <span className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
          {resposta === "ajuste"
            ? "O que precisa mudar?"
            : "Quer comentar alguma coisa? (opcional)"}
        </span>
        <textarea
          name="comentario"
          rows={4}
          placeholder={
            resposta === "ajuste"
              ? "Ex: o título da primeira seção não fala do nosso público"
              : "Opcional"
          }
          className="mt-1 w-full rounded-[12px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
        />
      </label>

      {estado.erro ? (
        <p className="text-sm text-red-700 mt-2" role="alert">
          {estado.erro}
        </p>
      ) : null}

      <div className="mt-4">
        <Enviar desabilitado={!resposta} />
      </div>
    </form>
  );
}

/**
 * useFormStatus precisa estar DENTRO do form pra enxergar o envio — por
 * isso é um componente à parte, e não um `pending` do useActionState lido
 * no mesmo nível do <form>.
 */
function Enviar({ desabilitado }: { desabilitado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={desabilitado || pending}
      className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 transition disabled:opacity-50"
    >
      {pending ? "Enviando…" : "Enviar resposta"}
    </button>
  );
}
