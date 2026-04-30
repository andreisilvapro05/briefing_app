"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { loadCliente } from "@/lib/storage";
import { blocosForProject } from "@/lib/briefing-schema";

export default function BriefingEntryPage() {
  const router = useRouter();

  useEffect(() => {
    const cliente = loadCliente();
    if (!cliente) {
      router.replace("/");
      return;
    }
    if (!cliente.projectType) {
      router.replace("/projeto");
      return;
    }
    const blocos = blocosForProject(cliente.projectType);
    const first = blocos[0];
    if (first) {
      router.replace(`/briefing/${first.id}`);
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <Shell tone="cream" hideHeader>
      <ContentFrame size="md">
        <p className="text-fysi-muted text-sm">Carregando briefing…</p>
      </ContentFrame>
    </Shell>
  );
}
