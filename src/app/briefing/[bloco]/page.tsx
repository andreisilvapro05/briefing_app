"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { BlocoShell } from "@/components/briefing/bloco-shell";
import { BlocoMateriais } from "@/components/briefing/bloco-materiais";
import { BlocoIdentificacao } from "@/components/briefing/bloco-identificacao";
import { BlocoIdentidadeVisual } from "@/components/briefing/bloco-identidade-visual";
import { BlocoLinguagemTom } from "@/components/briefing/bloco-linguagem-tom";
import { BlocoReferencias } from "@/components/briefing/bloco-referencias";
import { BlocoCopy } from "@/components/briefing/bloco-copy";
import { BlocoTextosProntos } from "@/components/briefing/bloco-textos-prontos";
import { blocosForProject } from "@/lib/briefing-schema";
import { loadCliente } from "@/lib/storage";
import type { Cliente } from "@/lib/types";

const BLOCO_COMPONENTS: Record<string, React.ComponentType> = {
  materiais: BlocoMateriais,
  "identificacao-contatos": BlocoIdentificacao,
  "identidade-visual": BlocoIdentidadeVisual,
  "linguagem-tom": BlocoLinguagemTom,
  "referencias-concorrencia": BlocoReferencias,
  "briefing-copy": BlocoCopy,
  "textos-prontos": BlocoTextosProntos,
};

export default function BlocoPage() {
  const router = useRouter();
  const params = useParams<{ bloco: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const c = loadCliente();
    if (!c) {
      router.replace("/");
      return;
    }
    if (!c.projectType) {
      router.replace("/projeto");
      return;
    }
    setCliente(c);
    setLoaded(true);
  }, [router]);

  const blocos = useMemo(
    () => (cliente?.projectType ? blocosForProject(cliente.projectType) : []),
    [cliente]
  );

  const currentIdx = blocos.findIndex((b) => b.id === params.bloco);
  const current = currentIdx === -1 ? undefined : blocos[currentIdx];
  const prev = currentIdx > 0 ? blocos[currentIdx - 1] : undefined;
  const next =
    currentIdx >= 0 && currentIdx < blocos.length - 1
      ? blocos[currentIdx + 1]
      : undefined;
  const isLast = currentIdx === blocos.length - 1;

  if (!loaded) {
    return (
      <Shell tone="cream" hideHeader>
        <ContentFrame size="md">
          <p className="text-fysi-muted text-sm">Carregando…</p>
        </ContentFrame>
      </Shell>
    );
  }

  if (!current) {
    return (
      <Shell tone="cream">
        <ContentFrame size="md">
          <h1 className="fysi-display text-2xl mb-3">Bloco não encontrado.</h1>
          <p className="text-fysi-muted text-sm">
            Este bloco não faz parte do tipo de projeto que você contratou.
          </p>
        </ContentFrame>
      </Shell>
    );
  }

  const BlocoComponent = BLOCO_COMPONENTS[current.id];

  const steps = blocos.map((b) => ({
    id: b.id,
    label: shortLabel(b.titulo),
  }));

  return (
    <BlocoShell
      steps={steps}
      currentStepId={current.id}
      numero={currentIdx + 1}
      titulo={current.titulo}
      descricao={current.descricao}
      prevHref={prev ? `/briefing/${prev.id}` : undefined}
      nextHref={next ? `/briefing/${next.id}` : "/briefing/revisao"}
      isLast={isLast}
    >
      {BlocoComponent ? <BlocoComponent /> : null}
    </BlocoShell>
  );
}

function shortLabel(titulo: string) {
  // Pega só a primeira palavra significativa para caber no step indicator.
  const map: Record<string, string> = {
    "Identificação e contatos": "Contatos",
    "Identidade visual": "Visual",
    "Linguagem e tom da marca": "Tom",
    "Referências e concorrência": "Referências",
    "Briefing de copy": "Copy",
    "Textos prontos": "Textos",
  };
  return map[titulo] ?? titulo.split(" ")[0];
}
