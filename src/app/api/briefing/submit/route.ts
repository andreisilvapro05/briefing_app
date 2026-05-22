import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { createClickUpBriefingTask } from "@/lib/clickup";
import {
  htmlBriefingConcluido,
  htmlBriefingNotificacaoTime,
  sendEmail,
} from "@/lib/email";
import { getServerEnv } from "@/lib/env";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Finaliza o briefing.
 *
 * Sequência:
 * 1. Marca o cliente como 'concluido' no banco (se Supabase configurado).
 * 2. Persiste o snapshot de respostas (briefing_responses) — caso ainda não tenha.
 * 3. Cria a tarefa estruturada no ClickUp.
 * 4. Envia e-mail de confirmação para o cliente.
 *
 * Se Supabase/ClickUp/Resend não estiverem configurados, retorna sucesso parcial
 * com `mode: "demo"` para que o fluxo continue e o cliente veja a tela de sucesso.
 */

const Body = z.object({
  cliente: z.object({
    id: z.string().optional(),
    nome: z.string(),
    email: z.string().email(),
    empresa: z.string(),
    whatsapp: z.string(),
    projectType: z.string().optional(),
  }),
  responses: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    // Modo demo total — só responde sucesso.
    return NextResponse.json({ mode: "demo", ok: true });
  }

  const adminPanelLink = `${env.appUrl}/admin`;

  // 1+2 — Persistência Supabase
  let clientId: string | undefined;
  try {
    const service = createSupabaseServiceRoleClient();

    // Prefere o clientId que o cliente já tem (de /api/auth/start ou
    // /api/auth/login) — evita criar um cliente duplicado no envio.
    if (parsed.cliente.id) {
      const { data: byId } = await service
        .from("clients")
        .select("id")
        .eq("id", parsed.cliente.id)
        .maybeSingle();
      clientId = byId?.id;
    }

    // Compat: fluxo legado por magic-link (sessão Supabase Auth).
    if (!clientId) {
      try {
        const supabase = await createSupabaseServerClient();
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: existing } = await service
            .from("clients")
            .select("id")
            .eq("auth_user_id", userData.user.id)
            .maybeSingle();
          clientId = existing?.id;
        }
      } catch {
        // sem auth — segue pro caminho de criação
      }
    }

    if (!clientId) {
      // Cria cliente sem auth (modo "envio direto")
      const { data: created, error: insertErr } = await service
        .from("clients")
        .insert({
          nome: parsed.cliente.nome,
          email: parsed.cliente.email,
          empresa: parsed.cliente.empresa,
          whatsapp: parsed.cliente.whatsapp,
          project_type: parsed.cliente.projectType,
          status: "concluido",
          briefing_submitted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insertErr) throw new Error(insertErr.message);
      clientId = created?.id;
    } else {
      await service
        .from("clients")
        .update({
          status: "concluido",
          briefing_submitted_at: new Date().toISOString(),
          project_type: parsed.cliente.projectType,
        })
        .eq("id", clientId);
    }

    // Persiste todas as respostas
    if (clientId) {
      const rows = Object.entries(parsed.responses).map(([key, value]) => {
        const [blocoId] = key.split(".");
        return {
          client_id: clientId!,
          bloco_id: blocoId,
          field_id: key,
          value: value as never,
        };
      });
      if (rows.length) {
        await service.from("briefing_responses").upsert(rows, {
          onConflict: "client_id,field_id",
        });
      }
    }
  } catch (err) {
    logServerError("submit.supabase", err);
    // Não bloqueamos — seguimos para ClickUp e e-mail.
  }

  // Conta arquivos vinculados a este cliente (usado por ClickUp + e-mail)
  let filesCount = 0;
  if (clientId) {
    try {
      const service = createSupabaseServiceRoleClient();
      const { count } = await service
        .from("briefing_files")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId);
      filesCount = count ?? 0;
    } catch {
      // Best-effort
    }
  }

  // 3 — ClickUp
  let clickupTaskId: string | undefined;
  try {
    const result = await createClickUpBriefingTask({
      cliente: {
        id: clientId ?? "demo",
        nome: parsed.cliente.nome,
        email: parsed.cliente.email,
        empresa: parsed.cliente.empresa,
        whatsapp: parsed.cliente.whatsapp,
        projectType: parsed.cliente.projectType as never,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      responses: parsed.responses,
      filesCount,
      publicLinkParaPainelAdmin: clientId
        ? `${adminPanelLink}/${clientId}`
        : adminPanelLink,
    });
    clickupTaskId = result.taskId;

    // Persiste o id da task na tabela clients
    if (clientId && clickupTaskId) {
      const service = createSupabaseServiceRoleClient();
      await service
        .from("clients")
        .update({ clickup_task_id: clickupTaskId })
        .eq("id", clientId);
    }
  } catch (err) {
    logServerError("submit.clickup", err);
  }

  // 4 — E-mail confirmação pro CLIENTE
  try {
    await sendEmail({
      to: parsed.cliente.email,
      subject: `Briefing recebido — Fysi Lab`,
      html: htmlBriefingConcluido({
        nome: parsed.cliente.nome.split(" ")[0],
        empresa: parsed.cliente.empresa,
        link: `${env.appUrl}/dashboard`,
      }),
    });
  } catch (err) {
    logServerError("submit.email-cliente", err);
  }

  // 5 — Notificação pro TIME Fysi com o briefing inteiro
  try {
    await sendEmail({
      to: env.teamEmail,
      subject: `Novo briefing · ${parsed.cliente.empresa} (${parsed.cliente.nome})`,
      html: htmlBriefingNotificacaoTime({
        cliente: {
          nome: parsed.cliente.nome,
          email: parsed.cliente.email,
          empresa: parsed.cliente.empresa,
          whatsapp: parsed.cliente.whatsapp,
          projectType: parsed.cliente.projectType,
        },
        responses: parsed.responses,
        filesCount,
        adminLink: clientId
          ? `${adminPanelLink}/${clientId}`
          : adminPanelLink,
      }),
    });
  } catch (err) {
    logServerError("submit.email-time", err);
  }

  return NextResponse.json({ ok: true, clientId, clickupTaskId });
}
