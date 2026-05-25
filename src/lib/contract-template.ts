import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * Preenche um template .docx (com tags {{nome}}, {{cpf}} etc.) com os dados
 * do cliente e devolve o .docx resultante como Buffer.
 *
 * As tags do template seguem o padrão `{{nome_variavel}}`. Quebras de linha
 * dentro de uma variável são preservadas (linebreaks: true).
 */
export function fillDocxTemplate(
  templateBuffer: Buffer | Uint8Array,
  data: Record<string, string | number | undefined | null>
): Buffer {
  const zip = new PizZip(templateBuffer as Buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    // Valor padrão pra tags ausentes: string vazia (em vez de erro).
    nullGetter: () => "",
  });

  // Normaliza valores undefined/null pra string vazia.
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    normalized[k] = v == null ? "" : String(v);
  }

  doc.render(normalized);
  return Buffer.from(doc.getZip().generate({ type: "nodebuffer" }));
}

/**
 * Deriva os dados do cliente em strings prontas pra usar no template.
 *
 * - tipo_pessoa: "pessoa jurídica" se tem CNPJ, senão "pessoa física".
 * - documento_descricao / documento_numero: prioriza CNPJ → CPF → RG.
 * - endereco_cliente: junta endereço + CEP.
 * - data_contrato: hoje, formato "DD de [mês] de YYYY" em pt-BR.
 */
export function buildClientTemplateVars(client: {
  nome: string;
  email?: string | null;
  whatsapp?: string | null;
  empresa?: string | null;
  endereco?: string | null;
  cep?: string | null;
  cpf?: string | null;
  rg?: string | null;
  cnpj?: string | null;
  razao_social?: string | null;
}): Record<string, string> {
  const isPJ = !!(client.cnpj && client.cnpj.trim());
  const tipo_pessoa = isPJ ? "pessoa jurídica" : "pessoa física";

  let documento_descricao = "documento";
  let documento_numero = "";
  if (isPJ) {
    documento_descricao = "CNPJ";
    documento_numero = client.cnpj ?? "";
  } else if (client.cpf && client.cpf.trim()) {
    documento_descricao = "CPF";
    documento_numero = client.cpf;
  } else if (client.rg && client.rg.trim()) {
    documento_descricao = "RG";
    documento_numero = client.rg;
  }

  const endereco_cliente = [client.endereco, client.cep]
    .filter((p) => p && p.trim())
    .join(", CEP ");

  return {
    nome_cliente: client.nome,
    tipo_pessoa,
    documento_descricao,
    documento_numero,
    endereco_cliente,
    email_cliente: client.email ?? "",
    whatsapp_cliente: client.whatsapp ?? "",
    empresa_cliente: client.empresa ?? "",
    razao_social_cliente: client.razao_social ?? "",
    data_contrato: formatDateLong(new Date()),
  };
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function formatDateLong(d: Date): string {
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = MESES[d.getMonth()];
  const ano = d.getFullYear();
  return `${dia} de ${mes} de ${ano}`;
}
