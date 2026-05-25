import { getServerEnv } from "./env";

/**
 * Cliente mínimo da API GraphQL do Autentique.
 *
 * Doc: https://docs.autentique.com.br
 * Endpoint: https://api.autentique.com.br/v2/graphql
 * Auth: Bearer token (env AUTENTIQUE_API_TOKEN).
 *
 * Upload de arquivo segue o GraphQL multipart request spec
 * (https://github.com/jaydenseric/graphql-multipart-request-spec).
 */

const ENDPOINT = "https://api.autentique.com.br/v2/graphql";

export interface AutentiqueSigner {
  email: string;
  name?: string;
  // Default 'SIGN'. Pode ser também WITNESS, APPROVE etc. — ver doc.
  action?: "SIGN" | "WITNESS" | "APPROVE";
}

export interface CreateDocumentResult {
  id: string;
  name: string;
  originalUrl?: string;
  signedUrl?: string;
}

export interface DocumentStatus {
  id: string;
  name: string;
  // true se todos os signers já assinaram
  fullySigned: boolean;
  signedUrl?: string;
  originalUrl?: string;
  signers: {
    email: string;
    name?: string;
    signedAt?: string;
    rejectedAt?: string;
  }[];
}

function token(): string {
  const env = getServerEnv();
  if (!env.autentiqueToken) {
    throw new Error("AUTENTIQUE_API_TOKEN não configurado");
  }
  return env.autentiqueToken;
}

/**
 * Cria um documento no Autentique e dispara o convite de assinatura
 * pros signers (e-mail enviado pelo Autentique).
 */
export async function createDocument(opts: {
  name: string;
  file: Buffer | Uint8Array;
  fileName: string;
  fileMime: string;
  signers: AutentiqueSigner[];
}): Promise<CreateDocumentResult> {
  const bearer = token();

  const query = `
    mutation CreateDocument(
      $document: DocumentInput!,
      $signers: [SignerInput!]!,
      $file: Upload!
    ) {
      createDocument(
        document: $document,
        signers: $signers,
        file: $file
      ) {
        id
        name
        files { original signed }
      }
    }
  `;

  const variables = {
    document: { name: opts.name },
    signers: opts.signers.map((s) => ({
      email: s.email,
      name: s.name,
      action: s.action ?? "SIGN",
    })),
    file: null,
  };

  const operations = JSON.stringify({ query, variables });
  const map = JSON.stringify({ "0": ["variables.file"] });

  const formData = new FormData();
  formData.append("operations", operations);
  formData.append("map", map);
  // Cast pra BlobPart — TS recente é estrito com Uint8Array<ArrayBufferLike>.
  formData.append(
    "0",
    new Blob([opts.file as unknown as BlobPart], { type: opts.fileMime }),
    opts.fileName
  );

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}` },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.errors) {
    const detail = data?.errors
      ? JSON.stringify(data.errors)
      : `HTTP ${res.status}`;
    throw new Error(`Autentique createDocument falhou: ${detail}`);
  }

  const doc = data.data?.createDocument;
  if (!doc?.id) {
    throw new Error("Autentique createDocument: resposta sem id");
  }

  return {
    id: doc.id,
    name: doc.name,
    originalUrl: doc.files?.original,
    signedUrl: doc.files?.signed,
  };
}

/**
 * Consulta o estado atual de um documento (status de assinatura + URL do PDF).
 */
export async function getDocument(documentId: string): Promise<DocumentStatus> {
  const bearer = token();

  const query = `
    query Document($id: UUID!) {
      document(id: $id) {
        id
        name
        files { original signed }
        signatures {
          name
          email
          signed { event created_at }
          rejected { event created_at }
        }
      }
    }
  `;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { id: documentId },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.errors) {
    const detail = data?.errors
      ? JSON.stringify(data.errors)
      : `HTTP ${res.status}`;
    throw new Error(`Autentique getDocument falhou: ${detail}`);
  }

  const doc = data.data?.document;
  if (!doc?.id) {
    throw new Error("Autentique getDocument: documento não encontrado");
  }

  const signers = (doc.signatures ?? []).map(
    (s: {
      name?: string;
      email: string;
      signed?: { created_at?: string };
      rejected?: { created_at?: string };
    }) => ({
      email: s.email,
      name: s.name,
      signedAt: s.signed?.created_at,
      rejectedAt: s.rejected?.created_at,
    })
  );

  const fullySigned =
    signers.length > 0 && signers.every((s: { signedAt?: string }) => !!s.signedAt);

  return {
    id: doc.id,
    name: doc.name,
    fullySigned,
    signedUrl: doc.files?.signed,
    originalUrl: doc.files?.original,
    signers,
  };
}
