"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getOwnProfileAction,
  updateOwnPhotoAction,
  type OwnProfile,
} from "@/app/admin/actions";
import { downscaleImage } from "@/lib/downscale-image";

/**
 * Versão grande do upload de foto, pra página "Meu Perfil".
 *
 * O seletor de arquivo abre via <label htmlFor> NATIVO (input sr-only), não
 * via inputRef.click() — o padrão programático era bloqueado em alguns
 * navegadores (Safari) e a Karine reportou "não abre para upload da foto".
 * Com label nativo, clicar no botão OU no próprio avatar abre o seletor em
 * qualquer navegador, sem JavaScript no meio.
 */
const INPUT_ID = "perfil-foto-input";

export function ProfilePhotoUploader({
  urlKey,
  fallbackInitials,
}: {
  urlKey?: string | null;
  fallbackInitials: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [uploading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getOwnProfileAction(urlKey ?? null).then(setProfile);
  }, [urlKey]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        // Comprime no navegador — sem isso, foto de celular (>1MB) estoura
        // o limite de body da Server Action e derruba a página inteira.
        const compact = await downscaleImage(file);
        const fd = new FormData();
        fd.append("file", compact);
        if (urlKey) fd.append("key", urlKey);
        const res = await updateOwnPhotoAction(fd);
        if (!res.ok) {
          setError(humanUploadError(res.error));
          return;
        }
        setProfile((p) => (p ? { ...p, fotoUrl: res.url } : p));
        router.refresh();
      } catch {
        setError("Não consegui enviar a foto. Tenta de novo (ou uma imagem menor).");
      }
    });
  }

  const initials = profile?.initials ?? fallbackInitials;
  const canEdit = profile?.canEditPhoto ?? false;

  return (
    <div className="flex items-center gap-5">
      {/* O próprio avatar também abre o seletor quando pode editar */}
      <label
        htmlFor={canEdit ? INPUT_ID : undefined}
        title={canEdit ? "Trocar foto de perfil" : undefined}
        className={`w-24 h-24 rounded-full overflow-hidden grid place-items-center text-2xl font-bold shrink-0 bg-fysi-deep text-fysi-mint ${
          canEdit ? "cursor-pointer hover:brightness-95 transition" : ""
        }`}
      >
        {profile?.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.fotoUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          initials
        )}
      </label>
      <div className="flex flex-col gap-2">
        {profile === null ? (
          <p className="text-xs text-fysi-muted">Carregando…</p>
        ) : canEdit ? (
          <>
            <label
              htmlFor={INPUT_ID}
              className={`inline-flex w-fit items-center gap-1.5 rounded-full border border-fysi-line bg-white text-sm font-medium text-fysi-deep px-4 py-2 transition ${
                uploading
                  ? "opacity-50 pointer-events-none"
                  : "cursor-pointer hover:border-fysi-deep/40 hover:bg-fysi-cream/40"
              }`}
            >
              {uploading ? "Enviando…" : "📷 Trocar foto"}
            </label>
            <input
              id={INPUT_ID}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={onFileChange}
            />
            <p className="text-xs text-fysi-muted">
              Qualquer foto serve — ela é reduzida automaticamente. Dá pra
              clicar na foto também.
            </p>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </>
        ) : (
          <p className="text-xs text-fysi-muted max-w-xs">
            Sessão de senha compartilhada não tem foto própria — entre com
            seu login individual (e-mail + senha) pra poder trocar a foto.
          </p>
        )}
      </div>
    </div>
  );
}

function humanUploadError(code: string): string {
  switch (code) {
    case "not-image":
      return "Escolha um arquivo de imagem.";
    case "too-large":
      return "Imagem muito grande (máx. 5MB).";
    case "storage-not-configured":
      return "Armazenamento não configurado.";
    default:
      return "Não consegui trocar a foto. Tenta de novo.";
  }
}
