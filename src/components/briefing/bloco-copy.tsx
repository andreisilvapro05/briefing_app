"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup } from "@/components/ui/radio-group";
import { Repeater } from "@/components/ui/repeater";
import { TagInput } from "@/components/ui/tag-input";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { FieldGroup } from "./bloco-shell";
import { useBriefingField } from "@/lib/briefing-store";

const BLOCO = "briefing-copy";

export function BlocoCopy() {
  // 5.1 — Público
  const [dores, setDores] = useBriefingField(BLOCO, "dores", "");
  const [sonhos, setSonhos] = useBriefingField(BLOCO, "sonhos", "");
  const [objecoes, setObjecoes] = useBriefingField(BLOCO, "objecoes", "");
  const [jornada, setJornada] = useBriefingField(BLOCO, "jornada", "");

  // 5.2 — Sobre o serviço
  const [oQueEntregue, setOQueEntregue] = useBriefingField(
    BLOCO,
    "o-que-entregue",
    ""
  );
  const [diferenciais, setDiferenciais] = useBriefingField(
    BLOCO,
    "diferenciais",
    ""
  );
  const [faqs, setFaqs] = useBriefingField<{ p: string; r: string }[]>(
    BLOCO,
    "faqs",
    [{ p: "", r: "" }]
  );
  const [linkCurriculo, setLinkCurriculo] = useBriefingField(
    BLOCO,
    "link-curriculo",
    ""
  );
  const [midia, setMidia] = useBriefingField<
    { nome: string; url: string; descricao: string }[]
  >(BLOCO, "midia", []);
  const [especialidadeNomes, setEspecialidadeNomes] = useBriefingField(
    BLOCO,
    "especialidade-nomes",
    ""
  );
  const [comoFunciona, setComoFunciona] = useBriefingField(
    BLOCO,
    "como-funciona",
    ""
  );

  // 5.3 — SEO
  const [palavrasChave, setPalavrasChave] = useBriefingField<string[]>(
    BLOCO,
    "palavras-chave",
    []
  );
  const [palavrasAuxiliares, setPalavrasAuxiliares] = useBriefingField<
    string[]
  >(BLOCO, "palavras-auxiliares", []);

  // 5.4 — Depoimentos
  const [linkGoogle, setLinkGoogle] = useBriefingField(
    BLOCO,
    "link-google",
    ""
  );
  const [printsDepoimentos, setPrintsDepoimentos] = useBriefingField<
    UploadedFile[]
  >(BLOCO, "prints-depoimentos", []);
  const [depoimentosTexto, setDepoimentosTexto] = useBriefingField<
    { texto: string; autor: string }[]
  >(BLOCO, "depoimentos-texto", []);

  return (
    <>
      <FieldGroup
        title="5.1 · Público"
        description="Quem é a pessoa do outro lado da página? Quanto mais específico, melhor a copy."
      >
        <Textarea
          label="Dores e dificuldades da persona"
          rows={4}
          value={dores}
          onChange={(e) => setDores(e.target.value)}
          placeholder="O que ela está vivendo agora que faz ela buscar uma solução?"
          audioTranscribe
        />
        <Textarea
          label="Maiores sonhos da persona"
          rows={4}
          value={sonhos}
          onChange={(e) => setSonhos(e.target.value)}
          placeholder="O que ela quer alcançar? Como seria o cenário ideal?"
          audioTranscribe
        />
        <Textarea
          label="Objeções"
          rows={4}
          value={objecoes}
          onChange={(e) => setObjecoes(e.target.value)}
          placeholder="O que impede ela de comprar agora? Preço, tempo, medo, ceticismo..."
          audioTranscribe
        />
        <RadioGroup
          name="jornada"
          legend="Em que etapa da jornada de conversão essa pessoa está?"
          value={jornada}
          onChange={setJornada}
          options={[
            {
              value: "identificacao",
              label: "Identificação do problema",
              description: "Ela ainda nem tem certeza do que precisa.",
            },
            {
              value: "comparando",
              label: "Comparando soluções",
              description: "Já sabe o problema, está avaliando opções.",
            },
            {
              value: "pronto",
              label: "Pronto para comprar",
              description: "Falta empurrão final / quebra de objeção.",
            },
            {
              value: "outro",
              label: "Outro",
              description: "Vamos conversar sobre isso na chamada.",
            },
          ]}
        />
      </FieldGroup>

      <FieldGroup
        title="5.2 · Sobre o serviço/produto"
        description="O que você entrega, no detalhe."
      >
        <Textarea
          label="O que é entregue?"
          rows={4}
          value={oQueEntregue}
          onChange={(e) => setOQueEntregue(e.target.value)}
          placeholder="Descreva o serviço/produto, formato, prazo, escopo."
          audioTranscribe
        />
        <Textarea
          label="Diferenciais"
          rows={4}
          value={diferenciais}
          onChange={(e) => setDiferenciais(e.target.value)}
          placeholder="Por que escolher você e não outro? O que é único?"
        />

        <div>
          <p className="text-sm font-medium text-fysi-deep mb-2">
            Dúvidas e respostas frequentes
          </p>
          <Repeater
            value={faqs}
            onChange={setFaqs}
            newItem={() => ({ p: "", r: "" })}
            addLabel="+ Adicionar pergunta"
            renderItem={(item, _idx, update) => (
              <div className="flex flex-col gap-3">
                <Input
                  label="Pergunta"
                  value={item.p}
                  onChange={(e) => update({ ...item, p: e.target.value })}
                  placeholder="Ex: Quanto tempo dura o atendimento?"
                />
                <Textarea
                  label="Resposta"
                  rows={3}
                  value={item.r}
                  onChange={(e) => update({ ...item, r: e.target.value })}
                />
              </div>
            )}
          />
        </div>

        <Input
          label="Link do currículo (Lattes, LinkedIn, página própria)"
          name="link-curriculo"
          optional
          value={linkCurriculo}
          onChange={(e) => setLinkCurriculo(e.target.value)}
        />

        <div>
          <p className="text-sm font-medium text-fysi-deep mb-2">
            Já teve participações em mídia?{" "}
            <span className="font-normal text-fysi-muted text-xs">
              opcional
            </span>
          </p>
          <Repeater
            value={midia}
            onChange={setMidia}
            newItem={() => ({ nome: "", url: "", descricao: "" })}
            addLabel="+ Adicionar mídia"
            emptyLabel="Entrevistas, podcasts, matérias, livros etc."
            renderItem={(item, _idx, update) => (
              <div className="flex flex-col gap-3">
                <Input
                  label="Nome do veículo / publicação"
                  value={item.nome}
                  onChange={(e) =>
                    update({ ...item, nome: e.target.value })
                  }
                />
                <Input
                  label="Link"
                  value={item.url}
                  onChange={(e) => update({ ...item, url: e.target.value })}
                />
                <Input
                  label="Descrição curta"
                  value={item.descricao}
                  onChange={(e) =>
                    update({ ...item, descricao: e.target.value })
                  }
                />
              </div>
            )}
          />
        </div>

        <Textarea
          label="Nome da especialidade (e como o público a chama)"
          rows={3}
          value={especialidadeNomes}
          onChange={(e) => setEspecialidadeNomes(e.target.value)}
          placeholder="Ex: 'terapia cognitivo-comportamental' (TCC). Liste sinônimos e formas comuns."
        />
        <Textarea
          label="Como funciona o atendimento (passo a passo, duração)"
          rows={4}
          value={comoFunciona}
          onChange={(e) => setComoFunciona(e.target.value)}
          audioTranscribe
        />
      </FieldGroup>

      <FieldGroup
        title="5.3 · SEO"
        description="Palavras-chave que o cliente costuma usar para encontrar seu serviço."
      >
        <TagInput
          label="Palavras-chave principais"
          hint="Pressione Enter ou vírgula para adicionar."
          value={palavrasChave}
          onChange={setPalavrasChave}
        />
        <TagInput
          label="Palavras-chave auxiliares"
          hint="Variantes, sinônimos, termos correlatos."
          value={palavrasAuxiliares}
          onChange={setPalavrasAuxiliares}
        />
      </FieldGroup>

      <FieldGroup
        title="5.4 · Depoimentos"
        description="Social proof é fundamental. Envie tudo que tiver."
      >
        <Input
          label="Link do Google Meu Negócio"
          name="link-google"
          optional
          value={linkGoogle}
          onChange={(e) => setLinkGoogle(e.target.value)}
          placeholder="https://g.page/..."
        />
        <FileUpload
          label="Prints de depoimentos"
          hint="Imagens de WhatsApp, Instagram, e-mails…"
          accept="image/*"
          value={printsDepoimentos}
          onChange={setPrintsDepoimentos}
          pathPrefix="depoimentos"
        />

        <div>
          <p className="text-sm font-medium text-fysi-deep mb-2">
            Depoimentos por escrito
          </p>
          <Repeater
            value={depoimentosTexto}
            onChange={setDepoimentosTexto}
            newItem={() => ({ texto: "", autor: "" })}
            addLabel="+ Adicionar depoimento"
            renderItem={(item, _idx, update) => (
              <div className="flex flex-col gap-3">
                <Textarea
                  label="Depoimento"
                  rows={4}
                  value={item.texto}
                  onChange={(e) =>
                    update({ ...item, texto: e.target.value })
                  }
                />
                <Input
                  label="Autor"
                  value={item.autor}
                  onChange={(e) =>
                    update({ ...item, autor: e.target.value })
                  }
                  placeholder="Nome · profissão · cidade (o que tiver)"
                />
              </div>
            )}
          />
        </div>
      </FieldGroup>
    </>
  );
}
