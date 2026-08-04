/* eslint-disable */
/**
 * Gera o .docx do contrato de Tráfego Pago (Gestão de Anúncios) como TEMPLATE
 * com tags {{...}}, e imprime o base64 pra embutir no sistema.
 *
 * Uso: node scripts/gen-trafego-docx.cjs > /tmp/trafego.b64
 * (ou --write pra gravar direto no módulo TS)
 */
const PizZip = require("pizzip");
const fs = require("fs");
const path = require("path");

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Cada parágrafo: { text, style } style ∈ title|h2|normal|bold|center|sig
function p(text, style = "normal") {
  const align =
    style === "title" || style === "center"
      ? '<w:jc w:val="center"/>'
      : "";
  const spacing = '<w:spacing w:after="140" w:line="276" w:lineRule="auto"/>';
  const bold =
    style === "title" || style === "h2" || style === "bold"
      ? "<w:b/>"
      : "";
  const sz =
    style === "title"
      ? '<w:sz w:val="28"/>'
      : style === "h2"
        ? '<w:sz w:val="24"/>'
        : '<w:sz w:val="22"/>';
  const rPr = `<w:rPr>${bold}${sz}</w:rPr>`;
  const pPr = `<w:pPr>${spacing}${align}</w:pPr>`;
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(
    text
  )}</w:t></w:r></w:p>`;
}

const paras = [
  p("CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE GESTÃO DE ANÚNCIOS (TRÁFEGO PAGO)", "title"),
  p("Pelo presente instrumento particular, de um lado:"),
  p(
    "CONTRATADA: FÝSI LAB DIGITAL LTDA, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº 53.470.438/0001-08, com sede na Rua Karl Baasch, nº 28, Taió/SC, CEP 89.190-000, e-mail contato@fysilabdigital.com.br, neste ato representada na forma de seu contrato social por Karine Sackt;"
  ),
  p("e, de outro lado:"),
  p(
    "CONTRATANTE: {{nome_cliente}}, inscrita no {{documento_descricao}} sob o nº {{documento_numero}}, com endereço em {{endereco_cliente}}, e-mail {{email_cliente}}, neste ato representada por {{representante_cliente}};"
  ),
  p(
    'doravante denominadas em conjunto "Partes" e isoladamente "Parte", têm entre si justo e contratado o seguinte:'
  ),

  p("CLÁUSULA 1ª — DO OBJETO", "h2"),
  p(
    "1.1. O presente contrato tem por objeto a prestação, pela CONTRATADA à CONTRATANTE, de serviços de gestão de tráfego pago (anúncios) nas plataformas Meta Ads e/ou Google Ads, compreendendo: planejamento de campanhas, criação e configuração de campanhas e conjuntos de anúncios, definição de segmentação e públicos, otimização periódica e acompanhamento de métricas e resultados."
  ),
  p(
    "1.2. Não integra o objeto deste contrato a produção de peças criativas (artes, vídeos, copy de anúncio), que poderá ser objeto de contratação em separado."
  ),
  p(
    "1.3. A verba de mídia (valor investido diretamente nas plataformas de anúncio) é de responsabilidade exclusiva da CONTRATANTE, que deverá mantê-la cadastrada e paga diretamente à respectiva plataforma, não estando incluída no valor mensal previsto na Cláusula 3ª."
  ),

  p("CLÁUSULA 2ª — DO PRAZO DE VIGÊNCIA", "h2"),
  p(
    "2.1. O presente contrato vigora pelo prazo inicial de 1 (um) mês, contado da data de sua assinatura."
  ),
  p(
    "2.2. Findo o prazo inicial, o contrato renova-se automaticamente por períodos sucessivos de 3 (três) meses, sem necessidade de novo instrumento, salvo manifestação de qualquer das Partes em sentido contrário, por escrito, com antecedência mínima de {{aviso_previo}} dias do término do período em curso."
  ),
  p(
    "2.3. Encerrado o primeiro período renovado de 3 (três) meses, as renovações subsequentes seguem o mesmo ciclo de 3 (três) meses, nas mesmas condições deste instrumento, ressalvado o reajuste previsto na Cláusula 4ª."
  ),

  p("CLÁUSULA 3ª — DO VALOR E FORMA DE PAGAMENTO", "h2"),
  p(
    "3.1. Pela prestação dos serviços descritos na Cláusula 1ª, a CONTRATANTE pagará à CONTRATADA o valor mensal de {{valor_mensal}}."
  ),
  p(
    "3.2. O pagamento será realizado todo dia {{dia_pagamento}} de cada mês, mediante {{forma_pagamento}} (chave Pix: {{chave_pix}}), conforme dados informados pela CONTRATADA."
  ),
  p(
    "3.3. O atraso no pagamento sujeita a CONTRATANTE à incidência de multa de 2% (dois por cento) sobre o valor em aberto, juros de mora de 1% (um por cento) ao mês e correção monetária, sem prejuízo da suspensão dos serviços até a regularização."
  ),

  p("CLÁUSULA 4ª — DO REAJUSTE", "h2"),
  p(
    "4.1. O valor previsto na Cláusula 3ª será reajustado anualmente, a cada 12 (doze) meses de vigência, pela variação do IPCA/IBGE ou índice que vier a substituí-lo."
  ),

  p("CLÁUSULA 5ª — DAS OBRIGAÇÕES DA CONTRATADA", "h2"),
  p(
    "5.1. Executar os serviços descritos na Cláusula 1ª com zelo técnico, acompanhando o desempenho das campanhas e realizando os ajustes de otimização que entender necessários."
  ),
  p(
    "5.2. Reportar mensalmente à CONTRATANTE os principais resultados e métricas das campanhas em andamento."
  ),
  p(
    "5.3. Manter sigilo sobre informações, dados e materiais de acesso restrito da CONTRATANTE, nos termos da Cláusula 8ª."
  ),

  p("CLÁUSULA 6ª — DAS OBRIGAÇÕES DA CONTRATANTE", "h2"),
  p(
    "6.1. Fornecer, em tempo hábil, os acessos necessários (Gerenciador de Negócios, contas de anúncio, métodos de pagamento das plataformas) e as informações e materiais necessários à execução dos serviços."
  ),
  p(
    "6.2. Manter a verba de mídia das campanhas ativa e paga diretamente às plataformas, conforme Cláusula 1.3."
  ),
  p(
    "6.3. Aprovar ou solicitar ajustes em criativos, públicos e orçamentos submetidos pela CONTRATADA em prazo razoável, sob pena de suspensão ou atraso das campanhas sem responsabilidade da CONTRATADA."
  ),
  p("6.4. Efetuar o pagamento nas condições e prazos previstos na Cláusula 3ª."),

  p("CLÁUSULA 7ª — DA RESCISÃO", "h2"),
  p(
    "7.1. O presente contrato poderá ser rescindido por qualquer das Partes, a qualquer tempo, mediante aviso prévio por escrito com antecedência mínima de {{aviso_previo}} dias."
  ),
  p(
    "7.2. A rescisão sem aviso prévio no prazo da Cláusula 7.1 sujeitará a Parte inadimplente ao pagamento de multa equivalente a {{multa_rescisao}}% do valor da mensalidade vigente, sem prejuízo dos valores já devidos até a data efetiva de encerramento."
  ),
  p(
    "7.3. O descumprimento de qualquer obrigação prevista neste contrato, não sanado em até 10 (dez) dias após notificação, autoriza a Parte prejudicada a rescindir o contrato de pleno direito."
  ),

  p("CLÁUSULA 8ª — DA CONFIDENCIALIDADE", "h2"),
  p(
    "8.1. As Partes comprometem-se a manter sigilo sobre todas as informações confidenciais trocadas em razão deste contrato, incluindo dados de acesso, métricas, estratégias e informações comerciais, não as divulgando a terceiros sem autorização prévia e por escrito."
  ),

  p("CLÁUSULA 9ª — DA PROPRIEDADE INTELECTUAL", "h2"),
  p(
    "9.1. As estratégias, configurações de campanha e relatórios produzidos pela CONTRATADA no âmbito deste contrato poderão ser utilizados pela CONTRATADA como referência de portfólio e case, resguardadas informações confidenciais e dados sensíveis da CONTRATANTE, salvo manifestação em contrário."
  ),
  p(
    "9.2. As contas de anúncio, pixels e dados de campanha permanecem de titularidade da CONTRATANTE, inclusive após o término deste contrato."
  ),

  p("CLÁUSULA 10ª — DA LIMITAÇÃO DE RESPONSABILIDADE", "h2"),
  p(
    "10.1. Os resultados das campanhas de anúncios dependem de fatores externos ao controle da CONTRATADA, tais como algoritmos e políticas das plataformas, concorrência, sazonalidade e condições de mercado, razão pela qual a CONTRATADA não garante resultado, volume de vendas, leads ou retorno sobre investimento específico."
  ),
  p(
    "10.2. A CONTRATADA não se responsabiliza por bloqueios, suspensões ou penalizações aplicados pelas plataformas de anúncio em decorrência de políticas de terceiros, ressalvada comprovada má prática da CONTRATADA."
  ),

  p("CLÁUSULA 11ª — DAS DISPOSIÇÕES GERAIS", "h2"),
  p(
    "11.1. Este contrato não estabelece vínculo empregatício, societário ou de representação entre as Partes."
  ),
  p(
    "11.2. A tolerância de uma Parte quanto ao descumprimento de qualquer cláusula por outra não implicará novação ou renúncia de direitos."
  ),
  p("11.3. Este contrato obriga as Partes e seus eventuais sucessores a qualquer título."),

  p("CLÁUSULA 12ª — DO FORO", "h2"),
  p(
    "12.1. Fica eleito o foro da Comarca de {{cidade_foro}} para dirimir quaisquer dúvidas ou litígios decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja."
  ),
  p(
    "E, por estarem assim justas e contratadas, as Partes assinam o presente instrumento em 2 (duas) vias de igual teor."
  ),
  p("{{cidade_foro}}, {{data_contrato}}.", "center"),

  p("_________________________________________", "center"),
  p("FÝSI LAB DIGITAL LTDA — Karine Sackt (CONTRATADA)", "center"),
  p(" "),
  p("_________________________________________", "center"),
  p("{{nome_cliente}} — {{representante_cliente}} (CONTRATANTE)", "center"),
  p(" "),
  p("_________________________________________", "center"),
  p("TESTEMUNHA 1 — Nome: ____________________  CPF: ____________________"),
  p("_________________________________________", "center"),
  p("TESTEMUNHA 2 — Nome: ____________________  CPF: ____________________"),
];

const documentXml =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  "<w:body>" +
  paras.join("") +
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
  "</w:body></w:document>";

const contentTypes =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  "</Types>";

const rels =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

const zip = new PizZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", rels);
zip.file("word/document.xml", documentXml);

const buf = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
const b64 = buf.toString("base64");

if (process.argv.includes("--write")) {
  const out = path.join(
    __dirname,
    "..",
    "src",
    "lib",
    "contract-models",
    "trafego-pago-docx.ts"
  );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    "// GERADO por scripts/gen-trafego-docx.cjs — não editar à mão.\n" +
      "// Modelo .docx (template com tags {{...}}) do contrato de Tráfego Pago.\n" +
      "export const TRAFEGO_PAGO_DOCX_BASE64 =\n  " +
      JSON.stringify(b64) +
      ";\n"
  );
  console.error("Escrito em " + out + " (" + buf.length + " bytes)");
} else {
  process.stdout.write(b64);
}
