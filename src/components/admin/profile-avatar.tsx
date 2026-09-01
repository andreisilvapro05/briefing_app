"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
 * Só quem entrou com identidade própria (Caixa 0 / Supabase Auth) pode
 * trocar — sessão de senha compartilhada não tem "dono" pra foto.
 */
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getOwnProfileAction(urlKey ?? null).then(setProfile);
  }, [urlKey]);

  function pickFile() {
    if (!profile?.canEditPhoto || uploading) return;
    inputRef.current?.click();
  }

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

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={pickFile}
        disabled={!canEdit || uploading}
        title={canEdit ? "Trocar foto de perfil" : undefined}
        className={`w-9 h-9 rounded-full overflow-hidden grid place-items-center text-xs font-bold shrink-0 ${
          profile?.fotoUrl ? "" : "bg-fysi-deep text-fysi-mint"
        } ${canEdit ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}
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
      </button>
      {canEdit ? (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
      ) : null}
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
