"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { FysiMark } from "@/components/brand/fysi-mark";
import { loadCliente } from "@/lib/storage";

export default function ConcluidoPage() {
  const router = useRouter();
  const [nome, setNome] = useState<string>("");

  useEffect(() => {
    const c = loadCliente();
    if (c) setNome(c.nome.split(" ")[0]);
  }, []);

  return (
    <Shell tone="deep" sectionLabel="Briefing concluído">
      <ContentFrame size="md">
        <div className="flex flex-col items-start gap-6">
          <div className="h-12 w-12 rounded-full bg-fysi-yellow flex items-center justify-center">
            <FysiMark size={24} className="text-fysi-deep" />
          </div>

          <div className="flex flex-col gap-3">
            <Eyebrow className="text-fysi-mint/70">
              Onboarding concluído
            </Eyebrow>
            <h1 className="fysi-display text-fysi-cream text-4xl md:text-5xl">
              Recebido{nome ? `, ${nome}` : ""}.
            </h1>
            <p className="text-fysi-mint/80 text-base leading-relaxed max-w-xl">
              Seu briefing chegou estruturado para o time Fysi Lab. A partir
              daqui o trabalho passa a ser nosso. Você receberá em até 1 dia
              útil um e-mail com a confirmação e o agendamento da chamada de
              alinhamento.
            </p>
          </div>

          <div className="border-t border-white/10 pt-6 mt-2 w-full">
            <h2 className="text-fysi-cream text-sm font-medium mb-3">
              Próximos passos
            </h2>
            <ol className="flex flex-col gap-2 text-sm text-fysi-mint/80">
              <li>1 · Confirmação por e-mail (até 1 dia útil)</li>
              <li>2 · Chamada de alinhamento com moodboard</li>
              <li>3 · Início da etapa seguinte do projeto</li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <Button
              variant="accent"
              size="md"
              leadingIcon={<FysiMark size={14} />}
              onClick={() => router.push("/dashboard")}
              type="button"
            >
              Ver painel
            </Button>
          </div>
        </div>
      </ContentFrame>
    </Shell>
  );
}
