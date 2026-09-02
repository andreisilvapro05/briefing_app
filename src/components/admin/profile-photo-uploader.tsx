"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  getOwnProfileAction,
  updateOwnPhotoAction,
  type OwnProfile,
} from "@/app/admin/actions";

/**
 * Versão grande do upload de foto, pra página "Meu Perfil" — o avatar do
 * topbar (36px) é discreto demais pra ser a única forma de trocar a foto.
 */
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
    <div className="flex items-center gap-5">
      <div className="w-24 h-24 rounded-full overflow-hidden grid place-items-center text-2xl font-bold shrink-0 bg-fysi-deep text-fysi-mint">
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
      </div>
      <div className="flex flex-col gap-2">
        {profile === null ? (
          // Ainda carregando o perfil — não mostrar a mensagem de "sessão
          // compartilhada" antes de saber quem é (dava um flash confuso pra
          // quem TEM conta própria).
          <p className="text-xs text-fysi-muted">Carregando…</p>
        ) : canEdit ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={pickFile}
              disabled={uploading}
            >
              {uploading ? "Enviando…" : "📷 Trocar foto"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
            <p className="text-xs text-fysi-muted">JPG ou PNG, até 5MB.</p>
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
