import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function buildDiffAlertHtml(diffs: any[], date: string): string {
  const now = new Date().toLocaleString("fr-FR");
  const rows = diffs.map((d) => {
    const changeList = d.changes.map((c: string) => `<li style="margin:3px 0;color:#dc2626;font-size:13px">${c}</li>`).join("");
    return `
      <tr>
        <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top">
          <strong style="color:#111827">${d.client.name}</strong><br>
          <small style="color:#9ca3af">${d.client.url}</small>
        </td>
        <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top">
          <ul style="margin:0;padding:0 0 0 16px">${changeList}</ul>
        </td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Alerte Lutecia — Ecarts détectés</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:680px;margin:32px auto;padding:0 16px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08)">
      <div style="background:#0a0c0f;padding:28px 36px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="color:#ef4444;font-size:22px">▲</span>
          <span style="color:#fff;font-size:20px;font-weight:700">Lutecia — Ecarts détectés</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;margin:0">Analyse quotidienne · ${date} · Générée le ${now}</p>
      </div>
      <div style="padding:24px 36px">
        <p style="font-size:14px;color:#374151;margin:0 0 20px">
          Des différences ont été détectées entre l'analyse du matin (10H) et celle du soir (18H) sur
          <strong>${diffs.length} site${diffs.length > 1 ? "s" : ""}</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#fef2f2;border-bottom:2px solid #fecaca">
              <th style="text-align:left;padding:10px 16px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;width:40%">Site</th>
              <th style="text-align:left;padding:10px 16px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em">Ecarts matin → soir</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 36px;text-align:center">
        <p style="margin:0;font-size:12px;color:#9ca3af">Lutecia Monitoring · Alerte automatique intra-journalière</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const slot: string = body.slot ?? "morning";

    if (slot !== "morning" && slot !== "evening") {
      return new Response(
        JSON.stringify({ error: "slot doit être 'morning' ou 'evening'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch all clients
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("*");
    if (clientsError) throw clientsError;
    if (!clients?.length) {
      return new Response(
        JSON.stringify({ message: "Aucun client à analyser", slot }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/check-site`;
    const today = new Date().toISOString().split("T")[0];

    // Run checks for all clients (batches of 3 to avoid timeouts)
    const results: Record<string, any> = {};
    for (let i = 0; i < clients.length; i += 3) {
      const batch = clients.slice(i, i + 3);
      await Promise.all(batch.map(async (c: any) => {
        try {
          const resp = await fetch(checkUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ client: { id: c.id, name: c.name, url: c.url, domain: c.domain, tags: c.tags }, skip_alert: true }),
          });
          if (resp.ok) {
            results[c.id] = await resp.json();
          }
        } catch (err) {
          console.error(`check-site failed for ${c.name}:`, err);
        }
      }));
    }

    // Upsert snapshots
    const snapshots = clients.map((c: any) => {
      const r = results[c.id];
      return {
        client_id: c.id,
        slot,
        snapshot_date: today,
        http_ok: r?.http?.ok ?? r?.http?.success ?? false,
        ssl_ok: r?.ssl?.ok ?? r?.ssl?.success ?? false,
        dns_ok: r?.dns?.ok ?? r?.dns?.success ?? false,
        http_status_code: r?.http?.statusCode ?? r?.http?.status ?? null,
        ssl_days_left: r?.ssl?.daysLeft ?? null,
        response_time_ms: r?.http?.responseTime ?? null,
        issues: r?.issues ?? [],
        checked_at: r?.checkedAt ?? new Date().toISOString(),
      };
    });

    const { error: upsertError } = await supabase
      .from("daily_snapshots")
      .upsert(snapshots, { onConflict: "client_id,slot,snapshot_date" });
    if (upsertError) console.error("Upsert error:", upsertError);

    // Purge snapshots older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await supabase
      .from("daily_snapshots")
      .delete()
      .lt("snapshot_date", thirtyDaysAgo.toISOString().split("T")[0]);

    // If evening slot: compare with morning and send alert if diffs found
    if (slot === "evening") {
      const { data: morningSnaps } = await supabase
        .from("daily_snapshots")
        .select("*")
        .eq("slot", "morning")
        .eq("snapshot_date", today);

      const { data: eveningSnaps } = await supabase
        .from("daily_snapshots")
        .select("*")
        .eq("slot", "evening")
        .eq("snapshot_date", today);

      const clientMap: Record<string, any> = {};
      clients.forEach((c: any) => { clientMap[c.id] = c; });

      const diffs: any[] = [];
      for (const evening of (eveningSnaps ?? [])) {
        const morning = (morningSnaps ?? []).find((m: any) => m.client_id === evening.client_id);
        if (!morning) continue;

        const changes: string[] = [];

        if (morning.http_ok && !evening.http_ok) {
          changes.push(`Site devenu inaccessible (HTTP ${evening.http_status_code ?? "N/A"})`);
        } else if (!morning.http_ok && evening.http_ok) {
          changes.push(`Site revenu en ligne (HTTP ${evening.http_status_code})`);
        } else if (morning.http_status_code !== evening.http_status_code && evening.http_status_code) {
          changes.push(`Code HTTP modifié: ${morning.http_status_code} → ${evening.http_status_code}`);
        }

        if (morning.ssl_ok && !evening.ssl_ok) {
          changes.push("Certificat SSL invalide");
        }
        if (morning.dns_ok && !evening.dns_ok) {
          changes.push("DNS non résolu");
        }

        const isTtfbIssue = (i: string) => /ttfb/i.test(i);

        const morningIssueSet = new Set(morning.issues ?? []);
        const newIssues = (evening.issues ?? []).filter((i: string) => !morningIssueSet.has(i) && !isTtfbIssue(i));
        if (newIssues.length > 0) {
          changes.push(`Nouvelle${newIssues.length > 1 ? "s" : ""} alerte${newIssues.length > 1 ? "s" : ""}: ${newIssues.join(" | ")}`);
        }

        const eveningIssueSet = new Set(evening.issues ?? []);
        const resolved = (morning.issues ?? []).filter((i: string) => !eveningIssueSet.has(i) && !isTtfbIssue(i));
        if (resolved.length > 0) {
          changes.push(`Alerte${resolved.length > 1 ? "s" : ""} résolue${resolved.length > 1 ? "s" : ""}: ${resolved.join(" | ")}`);
        }

        if (changes.length > 0) {
          diffs.push({ client: clientMap[evening.client_id], changes, morning, evening });
        }
      }

      if (diffs.length > 0) {
        const { data: smtpRow } = await supabase
          .from("smtp_config")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (smtpRow?.host) {
          try {
            const transporter = nodemailer.createTransport({
              host: smtpRow.host,
              port: smtpRow.port ?? 587,
              secure: smtpRow.port === 465,
              auth: { user: smtpRow.smtp_user, pass: smtpRow.smtp_pass },
            });

            const dateStr = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
            await transporter.sendMail({
              from: `"Lutecia Monitoring" <${smtpRow.smtp_user}>`,
              to: "nicolas.sinou@live.fr",
              subject: `Lutecia — ${diffs.length} écart${diffs.length > 1 ? "s" : ""} détecté${diffs.length > 1 ? "s" : ""} · ${dateStr}`,
              html: buildDiffAlertHtml(diffs, dateStr),
            });
          } catch (mailErr) {
            console.error("Failed to send diff alert:", mailErr);
          }
        }
      }

      return new Response(
        JSON.stringify({
          slot,
          clients_checked: clients.length,
          snapshots_saved: snapshots.length,
          diffs_detected: diffs.length,
          alert_sent: diffs.length > 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ slot, clients_checked: clients.length, snapshots_saved: snapshots.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("daily-check error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
