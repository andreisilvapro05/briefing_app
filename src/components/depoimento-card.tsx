"use client";

import { useEffect, useState } from "react";
import { Eyebrow } from "@/components/ui/pill";

/**
 * "Como foi trabalhar com a Fysi" — o bloco do painel do cliente.
 *
 * PRD de 05/10: "no painel do cliente aparece o bloco (...) depoimento em
 * texto, nota de 0 a 10 (...) e autorização de uso".
 *
 * Só aparece quando a equipe abriu a prova daquele projeto: pedir
 * depoimento no meio da execução é pedir cedo demais, e quem decide a hora
 * é a equipe, abrindo a prova.
 *
 * ⚠️ O ÁUDIO ficou de fora desta versão. O PRD pede "texto ou áudio,
 * reaproveitando gravação e transcrição", e o app tem as duas coisas
 * (`AudioRecorder` + `/api/transcribe`) — mas o caminho hoje grava no
 * briefing, e ligar aqui exige decidir onde o arquivo mora. Fica anotado;
 * o campo `depoimento_audio_path` já existe na tabela.
 */

interface NivelInfo {
  nivel: number;
  titulo: string;
  descricao: string;
}

interface ProvaDoPainel {
  id: string;
  jaRespondeu: boolean;
  nivel: number | null;
  depoimento: string | null;
  nota: number | null;
}

export function DepoimentoCard({ clientId }: { clientId: string }) {
  const [prova, setProva] = useState<ProvaDoPainel | null>(null);
  const [niveis, setNiveis] = useState<NivelInfo[]>([]);
  const [termos, setTermos] = useState<Record<string, string>>({});
  const [carregou, setCarregou] = useState(false);

  const [depoimento, setDepoimento] = useState("");
  const [nota, setNota] = useState("");
  const [nivel, setNivel] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/me/prova", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelado || !d) {
          if (!cancelado) setCarregou(true);
          return;
        }
        setProva(d.prova ?? null);
        setNiveis(d.niveis ?? []);
        setTermos(d.termos ?? {});
        if (d.prova) {
          setDepoimento(d.prova.depoimento ?? "");
          setNota(d.prova.nota === null ? "" : String(d.prova.nota));
          setNivel(d.prova.nivel ? String(d.prova.nivel) : "");
        }
        setCarregou(true);
      })
      .catch(() => {
        if (!cancelado) setCarregou(true);
      });
    return () => {
      cancelado = true;
    };
  }, [clientId]);

  // Sem prova aberta, o bloco não existe — e enquanto carrega também não,
  // pra não piscar um card vazio no painel de quem nunca vai vê-lo.
  if (!carregou || !prova) return null;

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/me/prova", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, depoimento, nota, nivel }),
      });
      const d = (await r.json().catch(() => null)) as {
        ok?: boolean;
        erro?: string;
      } | null;
      if (!r.ok || !d?.ok) {
        setErro(d?.erro ?? "Não consegui enviar agora. Tente de novo.");
        return;
      }
      setPronto(true);
    } catch {
      setErro("Não consegui enviar. Confira sua conexão.");
    } finally {
      setEnviando(false);
    }
  }

  if (pronto || prova.jaRespondeu) {
    return (
      <section className="bg-white border border-fysi-line rounded-[24px] p-6">
        <Eyebrow className="mb-3 block">Como foi trabalhar com a Fysi</Eyebrow>
        <p className="text-sm text-fysi-deep">
          Recebemos, obrigada. Isso ajuda muito a gente.
        </p>
        {depoimento.trim() ? (
          <p className="text-sm text-fysi-muted mt-2 italic">“{depoimento}”</p>
        ) : null}
        <p className="text-xs text-fysi-muted mt-3">
          Se quiser mudar ou retirar essa autorização, é só falar com a gente.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-fysi-line rounded-[24px] p-6">
      <Eyebrow className="mb-3 block">Como foi trabalhar com a Fysi</Eyebrow>
      <p className="text-sm text-fysi-muted mb-4">
        Se quiser, conte em poucas linhas como foi. Você escolhe até onde a
        gente pode usar o que você escrever.
      </p>

      <label className="flex flex-col gap-1 mb-3">
        <span className="text-xs uppercase tracking-[0.1em] text-fysi-muted font-medium">
          Seu depoimento (opcional)
        </span>
        <textarea
          value={depoimento}
          onChange={(e) => setDepoimento(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="O que mudou, o que você mais gostou, como foi o processo…"
          className="rounded-[12px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
        />
      </label>

      <label className="flex flex-col gap-1 mb-4 max-w-[10rem]">
        <span className="text-xs uppercase tracking-[0.1em] text-fysi-muted font-medium">
          Nota de 0 a 10
        </span>
        <input
          type="number"
          min={0}
          max={10}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          className="rounded-[12px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-2 text-fysi-deep"
        />
      </label>

      <fieldset className="mb-4">
        <legend className="text-xs uppercase tracking-[0.1em] text-fysi-muted font-medium mb-2">
          Até onde podemos usar
        </legend>
        <div className="flex flex-col gap-2">
          {niveis.map((n) => (
            <label
              key={n.nivel}
              className={`flex gap-2 items-start rounded-[12px] border px-3 py-2 cursor-pointer transition ${
                nivel === String(n.nivel)
                  ? "border-fysi-deep bg-fysi-mint/30"
                  : "border-fysi-line hover:border-fysi-deep/40"
              }`}
            >
              <input
                type="radio"
                name="nivel"
                value={n.nivel}
                checked={nivel === String(n.nivel)}
                onChange={(e) => setNivel(e.target.value)}
                className="mt-1 accent-fysi-deep"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fysi-deep">
                  {n.titulo}
                </span>
                <span className="block text-xs text-fysi-muted">
                  {n.descricao}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* O termo exato que vai ser gravado junto da resposta — a pessoa lê
          antes de aceitar, não depois. */}
      {nivel && termos[nivel] ? (
        <p className="text-xs text-fysi-muted bg-fysi-cream/60 border border-fysi-line rounded-[12px] px-3 py-2 mb-4">
          {termos[nivel]}
        </p>
      ) : null}

      {erro ? (
        <p
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-3 py-2 mb-3"
        >
          {erro}
        </p>
      ) : null}

      <button
        type="button"
        onClick={enviar}
        disabled={enviando}
        className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Enviar"}
      </button>
    </section>
  );
}
