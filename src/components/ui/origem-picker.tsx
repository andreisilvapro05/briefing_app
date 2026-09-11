"use client";

import { ORIGENS } from "@/lib/origem";

/**
 * Escolha de "como nos conheceu" em cartões coloridos, não num <select>.
 *
 * São radios de verdade por baixo (sr-only + <label>): teclado, leitor de
 * tela e validação de formulário continuam funcionando — o visual é só a
 * pele. Um <div> com onClick daria o mesmo desenho e quebraria os três.
 */
export function OrigemPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (valor: string) => void;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="text-sm font-medium text-fysi-deep mb-1.5">
        Como nos conheceu?
      </legend>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ORIGENS.map((o) => {
          const selecionado = value === o.value;
          return (
            <label
              key={o.value}
              className={`flex cursor-pointer items-center gap-2 rounded-[12px] border-2 px-3 py-2.5 text-sm font-medium transition ${
                selecionado
                  ? o.ativo
                  : "border-fysi-line bg-white text-fysi-deep hover:border-fysi-deep/25"
              }`}
            >
              <input
                type="radio"
                name="origem"
                value={o.value}
                checked={selecionado}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              <span aria-hidden="true" className="text-base leading-none">
                {o.emoji}
              </span>
              <span className="leading-tight">{o.label}</span>
              {selecionado ? (
                <span aria-hidden="true" className="ml-auto text-xs">
                  ✓
                </span>
              ) : null}
            </label>
          );
        })}
      </div>

      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </fieldset>
  );
}
