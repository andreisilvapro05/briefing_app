"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup } from "@/components/ui/radio-group";
import { Repeater } from "@/components/ui/repeater";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { FieldGroup } from "./bloco-shell";
import { useBriefingField } from "@/lib/briefing-store";

const BLOCO = "referencias-concorrencia";

interface Referencia {
  url: string;
  motivo: string;
}

interface Concorrente {
  url: string;
  nome: string;
}

export function BlocoReferencias() {
  const [referencias, setReferencias] = useBriefingField<Referencia[]>(
    BLOCO,
    "referencias",
    [{ url: "", motivo: "" }, { url: "", motivo: "" }, { url: "", motivo: "" }]
  );
  const [concorrentes, setConcorrentes] = useBriefingField<Concorrente[]>(
    BLOCO,
    "concorrentes",
    [{ url: "", nome: "" }, { url: "", nome: "" }, { url: "", nome: "" }]
  );
  const [bannerArquivos, setBannerArquivos] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "banner-arquivos",
    []
  );
  const [bannerLinks, setBannerLinks] = useBriefingField<{ url: string }[]>(
    BLOCO,
    "banner-links",
    []
  );
  const [siteArquivos, setSiteArquivos] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "site-arquivos",
    []
  );
  const [siteLinks, setSiteLinks] = useBriefingField<{ url: string }[]>(
    BLOCO,
    "site-links",
    []
  );
  const [trafegoPago, setTrafegoPago] = useBriefingField(
    BLOCO,
    "trafego-pago",
    ""
  );
  const [especialidades, setEspecialidades] = useBriefingField(
    BLOCO,
    "especialidades",
    ""
  );
  const [terMenu, setTerMenu] = useBriefingField(BLOCO, "ter-menu", "");
  const [bannerEstilo, setBannerEstilo] = useBriefingField(
    BLOCO,
    "banner-estilo",
    ""
  );

  return (
    <>
      <FieldGroup
        title="Referências visuais"
        description="Pelo menos 3 sites/páginas que você admira. Para cada um, conte o que gostou."
      >
        <Repeater
          value={referencias}
          onChange={setReferencias}
          newItem={() => ({ url: "", motivo: "" })}
          addLabel="+ Adicionar referência"
          min={3}
          renderItem={(item, _idx, update) => (
            <div className="flex flex-col gap-3">
              <Input
                label="URL"
                value={item.url}
                onChange={(e) => update({ ...item, url: e.target.value })}
                placeholder="https://..."
              />
              <Textarea
                label="O que gostou nessa referência"
                rows={3}
                value={item.motivo}
                onChange={(e) =>
                  update({ ...item, motivo: e.target.value })
                }
                placeholder="Hierarquia, tipografia, cor, fluxo, sensação..."
              />
            </div>
          )}
        />
      </FieldGroup>

      <FieldGroup
        title="Concorrentes"
        description="Locais, regionais ou mundiais. Pelo menos 3."
      >
        <Repeater
          value={concorrentes}
          onChange={setConcorrentes}
          newItem={() => ({ url: "", nome: "" })}
          addLabel="+ Adicionar concorrente"
          min={3}
          renderItem={(item, _idx, update) => (
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Nome"
                value={item.nome}
                onChange={(e) => update({ ...item, nome: e.target.value })}
                placeholder="Nome do concorrente"
              />
              <Input
                label="URL"
                value={item.url}
                onChange={(e) => update({ ...item, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          )}
        />
      </FieldGroup>

      <FieldGroup
        title="Banner principal"
        description="Imagens ou links que servem de referência para o banner inicial da página."
      >
        <FileUpload
          label="Imagens de referência para o banner"
          accept="image/*"
          value={bannerArquivos}
          onChange={setBannerArquivos}
          pathPrefix="banner-refs"
        />
        <Repeater
          value={bannerLinks}
          onChange={setBannerLinks}
          newItem={() => ({ url: "" })}
          addLabel="+ Adicionar link de referência"
          renderItem={(item, _idx, update) => (
            <Input
              label="URL"
              value={item.url}
              onChange={(e) => update({ url: e.target.value })}
              placeholder="https://..."
            />
          )}
        />
        <RadioGroup
          name="banner-estilo"
          legend="Como prefere ilustrar o banner?"
          value={bannerEstilo}
          onChange={setBannerEstilo}
          options={[
            {
              value: "imagem-propria",
              label: "Imagem própria profissional",
              description: "Foto do book ou produzida especificamente.",
            },
            {
              value: "imagem-mais-ilustracoes",
              label: "Imagem própria + ilustrações",
              description: "Composição com elementos gráficos.",
            },
            {
              value: "banco-imagens",
              label: "Imagem de banco de imagens",
              description: "Selecionamos juntos uma foto de banco.",
            },
          ]}
        />
      </FieldGroup>

      <FieldGroup
        title="Imagens e elementos para o site"
        description="Outras imagens, ilustrações ou elementos visuais que servem de referência."
      >
        <FileUpload
          label="Arquivos de referência"
          accept="image/*,application/pdf"
          value={siteArquivos}
          onChange={setSiteArquivos}
          pathPrefix="site-refs"
        />
        <Repeater
          value={siteLinks}
          onChange={setSiteLinks}
          newItem={() => ({ url: "" })}
          addLabel="+ Adicionar link"
          renderItem={(item, _idx, update) => (
            <Input
              label="URL"
              value={item.url}
              onChange={(e) => update({ url: e.target.value })}
              placeholder="https://..."
            />
          )}
        />
      </FieldGroup>

      <FieldGroup title="Operação e estrutura">
        <RadioGroup
          name="trafego-pago"
          legend="Empresa faz uso de tráfego pago?"
          value={trafegoPago}
          onChange={setTrafegoPago}
          layout="pills"
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "ainda-nao", label: "Ainda não, mas pretendemos" },
          ]}
        />
        <Textarea
          label="Especialidades / serviços oferecidos"
          name="especialidades"
          rows={4}
          value={especialidades}
          onChange={(e) => setEspecialidades(e.target.value)}
          placeholder="Liste o que a empresa oferece, em ordem de relevância."
          audioTranscribe
        />
        <RadioGroup
          name="ter-menu"
          legend="Site/Landing terá menu?"
          value={terMenu}
          onChange={setTerMenu}
          layout="pills"
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "nao-sei", label: "Não sei, vocês decidem" },
          ]}
        />
      </FieldGroup>
    </>
  );
}
