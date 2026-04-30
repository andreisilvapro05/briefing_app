import { Resend } from "resend";
import { getServerEnv } from "./env";

/**
 * Envio de e-mails transacionais via Resend.
 * Em modo demo (sem RESEND_API_KEY), apenas loga e retorna sucesso simulado.
 */

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(input: SendEmailInput) {
  const env = getServerEnv();
  if (!env.resendKey) {
    // Em modo demo, loga apenas o assunto pra debug — sem PII (e-mail/conteúdo).
    console.log("[email demo skipped]", input.subject);
    return { skipped: true };
  }
  const resend = new Resend(env.resendKey);
  const { data, error } = await resend.emails.send({
    from: env.resendFromEmail,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) throw new Error(error.message);
  return { id: data?.id };
}

export function htmlMagicLink({
  nome,
  link,
}: {
  nome: string;
  link: string;
}): string {
  return `<!doctype html>
<html><body style="font-family: -apple-system,Inter,sans-serif; background:#F7F6F4; color:#042B30; padding:32px;">
<div style="max-width:520px; margin:0 auto; background:#fff; padding:32px; border-radius:24px;">
  <h1 style="font-size:22px; margin:0 0 16px; font-weight:500;">Bem-vindo${nome ? `, ${nome}` : ""}.</h1>
  <p style="line-height:1.6; color:#6B7472;">Use o link abaixo para acessar seu painel da Fysi Lab e continuar o briefing de onde parou. O link é pessoal — não compartilhe.</p>
  <p style="margin-top:24px;">
    <a href="${link}" style="display:inline-block; background:#042B30; color:#F7F6F4; padding:14px 28px; border-radius:9999px; text-decoration:none; font-weight:500;">Acessar painel</a>
  </p>
  <p style="margin-top:32px; font-size:12px; color:#6B7472;">Este link expira em 24h. Se não foi você que solicitou, ignore este e-mail.</p>
</div>
</body></html>`;
}

export function htmlBriefingConcluido({
  nome,
  empresa,
  link,
}: {
  nome: string;
  empresa: string;
  link: string;
}): string {
  return `<!doctype html>
<html><body style="font-family: -apple-system,Inter,sans-serif; background:#F7F6F4; color:#042B30; padding:32px;">
<div style="max-width:520px; margin:0 auto; background:#fff; padding:32px; border-radius:24px;">
  <h1 style="font-size:22px; margin:0 0 16px; font-weight:500;">Recebido${nome ? `, ${nome}` : ""}.</h1>
  <p style="line-height:1.6; color:#6B7472;">Seu briefing chegou estruturado para o time Fysi Lab. Em até 1 dia útil você recebe a confirmação e o agendamento da chamada de alinhamento.</p>
  <p style="margin-top:24px;">
    <a href="${link}" style="display:inline-block; background:#042B30; color:#F7F6F4; padding:14px 28px; border-radius:9999px; text-decoration:none; font-weight:500;">Ver painel · ${empresa}</a>
  </p>
</div>
</body></html>`;
}

/**
 * E-mail enviado pra equipe Fysi quando um cliente conclui o briefing.
 * Inclui resumo de cabeçalho + dump completo das respostas + link pro admin.
 */
export function htmlBriefingNotificacaoTime({
  cliente,
  responses,
  filesCount,
  adminLink,
}: {
  cliente: {
    nome: string;
    email: string;
    empresa: string;
    whatsapp: string;
    projectType?: string | null;
  };
  responses: Record<string, unknown>;
  filesCount: number;
  adminLink: string;
}): string {
  // Agrupa respostas por bloco
  const byBloco = new Map<string, [string, unknown][]>();
  for (const [key, value] of Object.entries(responses)) {
    const [bloco, ...rest] = key.split(".");
    const list = byBloco.get(bloco) ?? [];
    list.push([rest.join("."), value]);
    byBloco.set(bloco, list);
  }

  const blocosHtml = Array.from(byBloco.entries())
    .map(([blocoId, fields]) => {
      const fieldsHtml = fields
        .map(([fieldId, value]) => {
          return `<tr>
            <td style="padding:8px 0; vertical-align:top; width:38%; color:#6B7472; font-size:12px; text-transform:uppercase; letter-spacing:0.06em;">${escape(
              fieldId
            )}</td>
            <td style="padding:8px 0; vertical-align:top; color:#042B30; font-size:14px; line-height:1.6;">${formatValueHtml(value)}</td>
          </tr>`;
        })
        .join("");

      return `<section style="margin-top:24px; padding-top:24px; border-top:1px solid #E5E5E0;">
        <h2 style="font-size:14px; text-transform:uppercase; letter-spacing:0.12em; color:#4F998A; margin:0 0 12px; font-weight:500;">${escape(blocoId)}</h2>
        <table style="width:100%; border-collapse:collapse;">${fieldsHtml}</table>
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html><body style="margin:0; font-family: -apple-system,Inter,sans-serif; background:#F7F6F4; color:#042B30;">
<div style="max-width:680px; margin:0 auto; padding:32px;">
  <div style="background:#042B30; color:#F7F6F4; padding:32px; border-radius:24px 24px 0 0;">
    <p style="margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:0.14em; color:#BFEDE0;">Briefing concluído</p>
    <h1 style="margin:0 0 4px; font-size:26px; font-weight:500; line-height:1.1;">${escape(cliente.empresa)}</h1>
    <p style="margin:0; color:#BFEDE0; font-size:14px;">${escape(cliente.nome)} · ${escape(cliente.email)} · ${escape(cliente.whatsapp)}</p>
    ${cliente.projectType ? `<p style="margin:12px 0 0; display:inline-block; background:#F4F99D; color:#042B30; padding:4px 12px; border-radius:9999px; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">${escape(cliente.projectType)}</p>` : ""}
  </div>

  <div style="background:#fff; padding:32px; border-radius:0 0 24px 24px; border:1px solid #E5E5E0; border-top:none;">
    <p style="margin:0; font-size:14px; color:#6B7472; line-height:1.6;">
      Cliente concluiu o briefing. ${filesCount > 0 ? `<strong style="color:#042B30;">${filesCount} arquivo${filesCount > 1 ? "s" : ""}</strong> ${filesCount > 1 ? "anexados" : "anexado"}.` : "Nenhum arquivo anexado."}
    </p>

    <a href="${adminLink}" style="display:inline-block; margin-top:20px; background:#042B30; color:#F7F6F4; padding:12px 24px; border-radius:9999px; text-decoration:none; font-weight:500; font-size:14px;">Abrir no painel admin →</a>

    ${blocosHtml}

    <p style="margin-top:32px; padding-top:24px; border-top:1px solid #E5E5E0; font-size:12px; color:#6B7472;">
      Notificação automática · Fysi Briefing · ${new Date().toLocaleString("pt-BR")}
    </p>
  </div>
</div>
</body></html>`;
}

function escape(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatValueHtml(value: unknown): string {
  if (value === null || value === undefined || value === "")
    return '<span style="color:#9CA3AF; font-style:italic;">(vazio)</span>';
  if (typeof value === "string") return escape(value).replace(/\n/g, "<br/>");
  if (typeof value === "number" || typeof value === "boolean")
    return escape(String(value));
  if (Array.isArray(value)) {
    if (value.length === 0)
      return '<span style="color:#9CA3AF; font-style:italic;">(vazio)</span>';
    return (
      "<ul style='margin:0; padding-left:18px;'>" +
      value
        .map(
          (v) =>
            `<li style="margin-bottom:4px;">${formatValueHtml(v)}</li>`
        )
        .join("") +
      "</ul>"
    );
  }
  if (typeof value === "object") {
    return (
      "<pre style='margin:0; font-size:12px; background:#F7F6F4; padding:8px; border-radius:6px; overflow-x:auto; font-family:ui-monospace,monospace;'>" +
      escape(JSON.stringify(value, null, 2)) +
      "</pre>"
    );
  }
  return escape(String(value));
}
