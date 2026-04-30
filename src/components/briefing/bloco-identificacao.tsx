"use client";

import { Input } from "@/components/ui/input";
import { Repeater } from "@/components/ui/repeater";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { FieldGroup } from "./bloco-shell";
import { useBriefingField } from "@/lib/briefing-store";

const BLOCO = "identificacao-contatos";

export function BlocoIdentificacao() {
  const [logos, setLogos] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "logos",
    []
  );
  const [whatsappSite, setWhatsappSite] = useBriefingField(
    BLOCO,
    "whatsapp-site",
    ""
  );
  const [telefone, setTelefone] = useBriefingField(BLOCO, "telefone", "");
  const [emailSite, setEmailSite] = useBriefingField(BLOCO, "email-site", "");
  const [horario, setHorario] = useBriefingField(BLOCO, "horario", "");
  const [endereco, setEndereco] = useBriefingField(BLOCO, "endereco", "");
  const [instagram, setInstagram] = useBriefingField(BLOCO, "instagram", "");
  const [facebook, setFacebook] = useBriefingField(BLOCO, "facebook", "");
  const [linkedin, setLinkedin] = useBriefingField(BLOCO, "linkedin", "");
  const [youtube, setYoutube] = useBriefingField(BLOCO, "youtube", "");
  const [outras, setOutras] = useBriefingField<{ url: string }[]>(
    BLOCO,
    "outras-redes",
    []
  );

  return (
    <>
      <FieldGroup
        title="Marca"
        description="Vamos começar pela base visual: logo e canais oficiais."
      >
        <FileUpload
          label="Logo da marca"
          hint="PNG ou SVG preferencialmente. Pode enviar mais de um arquivo (versão clara, escura, etc.)."
          accept="image/png,image/svg+xml,image/jpeg,application/pdf"
          value={logos}
          onChange={setLogos}
          pathPrefix="logos"
        />
      </FieldGroup>

      <FieldGroup
        title="Contatos para o site"
        description="Os contatos abaixo aparecem na página final e podem ser diferentes do contato pessoal."
      >
        <Input
          label="WhatsApp para o site"
          name="whatsapp-site"
          optional
          hint="Se for diferente do contato que você informou no início."
          value={whatsappSite}
          onChange={(e) => setWhatsappSite(e.target.value)}
          placeholder="(11) 90000-0000"
        />
        <Input
          label="Telefone fixo"
          name="telefone"
          optional
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
        />
        <Input
          label="E-mail para exibir no site"
          name="email-site"
          type="email"
          value={emailSite}
          onChange={(e) => setEmailSite(e.target.value)}
          placeholder="contato@empresa.com"
        />
        <Input
          label="Horário de atendimento"
          name="horario"
          value={horario}
          onChange={(e) => setHorario(e.target.value)}
          placeholder="Seg–Sex · 9h às 18h"
        />
        <Input
          label="Localização (endereço)"
          name="endereco"
          optional
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder="Cidade · Estado · ou endereço completo"
        />
      </FieldGroup>

      <FieldGroup
        title="Redes sociais"
        description="Apenas as redes que você mantém ativas. Deixe em branco o que não usa."
      >
        <Input
          label="Instagram"
          name="instagram"
          optional
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="https://instagram.com/..."
        />
        <Input
          label="Facebook"
          name="facebook"
          optional
          value={facebook}
          onChange={(e) => setFacebook(e.target.value)}
          placeholder="https://facebook.com/..."
        />
        <Input
          label="LinkedIn"
          name="linkedin"
          optional
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          placeholder="https://linkedin.com/in/..."
        />
        <Input
          label="YouTube"
          name="youtube"
          optional
          value={youtube}
          onChange={(e) => setYoutube(e.target.value)}
          placeholder="https://youtube.com/@..."
        />

        <div>
          <p className="text-sm font-medium text-fysi-deep mb-2">
            Outras redes ou links{" "}
            <span className="font-normal text-fysi-muted text-xs">
              opcional
            </span>
          </p>
          <Repeater
            value={outras}
            onChange={setOutras}
            newItem={() => ({ url: "" })}
            addLabel="+ Adicionar link"
            emptyLabel="Use isto para TikTok, Behance, Pinterest, GitHub, etc."
            renderItem={(item, _idx, update) => (
              <Input
                label="URL"
                value={item.url}
                onChange={(e) => update({ url: e.target.value })}
                placeholder="https://..."
              />
            )}
          />
        </div>
      </FieldGroup>
    </>
  );
}
