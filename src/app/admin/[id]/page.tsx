import { redirect } from "next/navigation";
import Link from "next/link";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resendClientLinkAction, sendToClickupAction } from "./actions";

export const dynamic = "force-dynamic";

interface BriefingResponse {
  field_id: string;
  bloco_id: string;
  value: unknown;
}

interface BriefingFile {
  field_id: string;
  file_name: string;
  public_url: string;
  size_bytes: number | null;
  mime_type: string | null;
}

export default async function AdminClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const service = createSupabaseServiceRoleClient();

  const [{ data: client }, { data: responses }, { data: files }] =
    await Promise.all([
      service.from("clients").select("*").eq("id", id).maybeSingle(),
      service.from("briefing_responses").select("*").eq("client_id", id),
      service.from("briefing_files").select("*").eq("client_id", id),
    ]);

  if (!client) {
    return (
      <Shell tone="cream">
        <ContentFrame size="md">
          <h1 className="fysi-display text-2xl mb-3">
            Cliente não encontrado.
          </h1>
          <Link
            href="/admin"
            className="text-sm text-fysi-deep hover:underline"
          >
            ← Voltar à lista
          </Link>
        </ContentFrame>
      </Shell>
    );
  }

  const byBloco = groupByBloco((responses as BriefingResponse[]) ?? []);
  const filesList: BriefingFile[] = (files as BriefingFile[]) ?? [];

  return (
    <Shell tone="cream" sectionLabel={`Briefing · ${client.empresa}`}>
      <ContentFrame size="xl">
        <Link
          href="/admin"
          className="text-xs text-fysi-muted hover:text-fysi-deep mb-6 inline-block"
        >
          ← Voltar à lista
        </Link>

        <header className="grid md:grid-cols-[2fr_1fr] gap-8 mb-10">
          <div>
            <Eyebrow>{client.project_type ?? "—"}</Eyebrow>
            <h1 className="fysi-display text-3xl md:text-4xl mt-2">
              {client.empresa}
            </h1>
            <p className="text-fysi-muted text-sm mt-1">
              {client.nome} · {client.email} · {client.whatsapp}
            </p>
          </div>

          <aside className="bg-white border border-fysi-line rounded-[16px] p-5 flex flex-col gap-3 text-sm">
            <div>
              <Eyebrow>Status</Eyebrow>
              <p className="mt-1 text-fysi-deep font-medium capitalize">
                {client.status.replace("-", " ")}
              </p>
            </div>
            {client.clickup_task_id ? (
              <div>
                <Eyebrow>ClickUp</Eyebrow>
                <p className="mt-1 text-xs text-fysi-deep">
                  Task: {client.clickup_task_id}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-fysi-line mt-2">
              <form action={resendClientLinkAction}>
                <input type="hidden" name="email" value={client.email} />
                <Button type="submit" size="sm" variant="secondary">
                  Reenviar link
                </Button>
              </form>
              {!client.clickup_task_id ? (
                <form action={sendToClickupAction}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <Button type="submit" size="sm" variant="primary">
                    Enviar ao ClickUp
                  </Button>
                </form>
              ) : null}
            </div>
          </aside>
        </header>

        <div className="flex flex-col gap-6">
          {Array.from(byBloco.entries()).map(([blocoId, fields]) => (
            <section
              key={blocoId}
              className="bg-white border border-fysi-line rounded-[20px] p-6"
            >
              <Eyebrow>{blocoId}</Eyebrow>
              <div className="mt-3 flex flex-col gap-4">
                {fields.map((f) => (
                  <div
                    key={f.field_id}
                    className="border-b border-fysi-line last:border-b-0 pb-4 last:pb-0"
                  >
                    <p className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
                      {f.field_id.replace(`${blocoId}.`, "")}
                    </p>
                    <pre className="text-sm text-fysi-deep mt-1 whitespace-pre-wrap break-words font-sans">
                      {renderValue(f.value)}
                    </pre>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {filesList.length > 0 ? (
            <section className="bg-white border border-fysi-line rounded-[20px] p-6">
              <Eyebrow>Arquivos enviados</Eyebrow>
              <ul className="mt-3 flex flex-col gap-2">
                {filesList.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 border border-fysi-line rounded-[12px] px-3 py-2"
                  >
                    <div className="flex flex-col min-w-0">
                      <a
                        href={f.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-fysi-deep font-medium hover:underline truncate"
                      >
                        {f.file_name}
                      </a>
                      <span className="text-xs text-fysi-muted">
                        {f.field_id} · {f.mime_type ?? "—"}
                      </span>
                    </div>
                    <Pill tone="outline">
                      {humanSize(f.size_bytes ?? 0)}
                    </Pill>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </ContentFrame>
    </Shell>
  );
}

function groupByBloco(rows: BriefingResponse[]) {
  const map = new Map<string, BriefingResponse[]>();
  for (const r of rows) {
    const list = map.get(r.bloco_id) ?? [];
    list.push(r);
    map.set(r.bloco_id, list);
  }
  return map;
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value, null, 2);
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
