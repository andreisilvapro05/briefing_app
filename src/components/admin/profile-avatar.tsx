"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getOwnProfileAction,
  updateOwnPhotoAction,
  type OwnProfile,
} from "@/app/admin/actions";

/**
 * Avatar do topbar — foto de perfil real quando a pessoa tem (upload
 * próprio), iniciais como fallback. Busca no cliente (como o sino de
 * notificações) pra não precisar tocar nos ~18 call-sites do AdminShell.
 *
 * O seletor de arquivo abre via <label htmlFor> nativo (input sr-only) —
 * o padrão inputRef.click() era bloqueado em alguns navegadores (Safari).
 */
const INPUT_ID = "topbar-foto-input";

export function ProfileAvatar({
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
    const fd = new FormData();
    fd.append("file", file);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      const res = await updateOwnPhotoAction(fd);
      if (!res.ok) {
        setError(humanUploadError(res.error));
        return;
      }
      setProfile((p) => (p ? { ...p, fotoUrl: res.url } : p));
      router.refresh();
    });
  }

  const initials = profile?.initials ?? fallbackInitials;
  const canEdit = profile?.canEditPhoto ?? false;

  const face = profile?.fotoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.fotoUrl} alt="" className="w-full h-full object-cover" />
  ) : (
    initials
  );

  return (
    <div className="relative shrink-0">
      {canEdit ? (
        <>
          <label
            htmlFor={INPUT_ID}
            title="Trocar foto de perfil"
            className={`w-9 h-9 rounded-full overflow-hidden grid place-items-center text-xs font-bold shrink-0 cursor-pointer hover:brightness-95 ${
              profile?.fotoUrl ? "" : "bg-fysi-deep text-fysi-mint"
            } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
          >
            {face}
          </label>
          <input
            id={INPUT_ID}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={onFileChange}
          />
        </>
      ) : (
        <span
          className={`w-9 h-9 rounded-full overflow-hidden grid place-items-center text-xs font-bold shrink-0 ${
            profile?.fotoUrl ? "" : "bg-fysi-deep text-fysi-mint"
          }`}
        >
          {face}
        </span>
      )}
      {error ? (
        <p className="absolute right-0 top-11 z-50 w-48 rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-xs text-red-600 shadow-lg">
          {error}
        </p>
      ) : null}
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
