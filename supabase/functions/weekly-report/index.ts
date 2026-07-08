import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function statusBadge(ok: boolean, label: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;background:${ok ? "#d1fae5" : "#fee2e2"};color:${ok ? "#065f46" : "#991b1b"}">${label}</span>`;
}

function warnBadge(label: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;background:#fef3c7;color:#92400e">${label}</span>`;
}

function idleBadge(label: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;background:#f3f4f6;color:#6b7280">${label}</span>`;
}

const labelStyle = `font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px`;

function buildClientCard(c: any, mon: any, dns: any, perf: any): string {
  if (!mon) {
    return `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:10px">
        <strong style="color:#111827;font-size:13px">${c.name}</strong>
        <br><span style="color:#9ca3af;font-size:11px">${c.url}</span>
        <div style="margin-top:8px;color:#9ca3af;font-size:12px">Non vérifié</div>
      </div>`;
  }

  const hasIssues = mon.issues?.length > 0;
  const dnsEmailOk = dns ? [dns.dns_mx?.ok, dns.dns_spf?.ok, dns.dns_dmarc?.ok].filter(Boolean).length >= 2 : null;
  const perfScore = perf?.desktop?.performance ?? perf?.desktop?.score ?? perf?.mobile?.performance ?? perf?.mobile?.score;
  const secScore = mon.http?.securityScore;

  const statusCell = hasIssues ? (mon.issues.length > 1 ? statusBadge(false, "Erreur") : warnBadge("Attention")) : statusBadge(true, "OK");
  const dnsCell = dnsEmailOk !== null ? statusBadge(dnsEmailOk, dnsEmailOk ? "OK" : "Attention") : idleBadge("N/A");
  const perfCell = perfScore !== undefined ? (perfScore >= 80 ? statusBadge(true, `${perfScore}/100`) : perfScore >= 50 ? warnBadge(`${perfScore}/100`) : statusBadge(false, `${perfScore}/100`)) : idleBadge("N/A");
  const secCell = secScore !== undefined ? (secScore >= 80 ? statusBadge(true, `${secScore}/100`) : secScore >= 40 ? warnBadge(`${secScore}/100`) : statusBadge(false, `${secScore}/100`)) : idleBadge("N/A");

  const issuesList = hasIssues
    ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb"><ul style="margin:0;padding:0 0 0 16px">${mon.issues.map((i: string) => `<li style="color:#dc2626;font-size:12px;margin:2px 0">${i}</li>`).join("")}</ul></div>`
    : "";

  return `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:10px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="vertical-align:middle;padding:0">
            <strong style="color:#111827;font-size:13px">${c.name}</strong>
            <br><span style="color:#9ca3af;font-size:11px">${c.url}</span>
          </td>
          <td style="vertical-align:middle;padding:0;text-align:right;white-space:nowrap">${statusCell}</td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-top:10px">
        <tr>
          <td style="width:50%;vertical-align:top;padding:0 8px 0 0">
            <div style="${labelStyle}">Email DNS</div>${dnsCell}
          </td>
          <td style="width:50%;vertical-align:top;padding:0">
            <div style="${labelStyle}">Perf PC</div>${perfCell}
          </td>
        </tr>
        <tr>
          <td style="width:50%;vertical-align:top;padding:8px 8px 0 0">
            <div style="${labelStyle}">Sécurité</div>${secCell}
          </td>
          <td style="width:50%;vertical-align:top;padding:8px 0 0 0"></td>
        </tr>
      </table>
      ${issuesList}
    </div>`;
}

function buildEmailHtml(clients: any[], monMap: Record<string, any>, dnsMap: Record<string, any>, perfMap: Record<string, any>, title: string): string {
  const now = new Date().toLocaleString("fr-FR");
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekLabel = `Semaine du ${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;

  const okCount = clients.filter(c => !monMap[c.id]?.issues?.length && monMap[c.id]).length;
  const alertCount = clients.filter(c => monMap[c.id]?.issues?.length > 0).length;
  const allOk = alertCount === 0;

  const cards = clients.map(c => buildClientCard(c, monMap[c.id], dnsMap[c.id], perfMap[c.id])).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport Lutecia</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:24px auto;padding:0 12px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08)">

      <div style="background:#0a0c0f;padding:24px 20px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="vertical-align:middle;padding:0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:8px"><path d="m10.852 19.772-.383.924"/><path d="m13.148 14.228.383-.923"/><path d="M13.148 19.772a3 3 0 1 0-2.296-5.544l-.383-.923"/><path d="m13.53 20.696-.382-.924a3 3 0 1 1-2.296-5.544"/><path d="m14.772 15.852.923-.383"/><path d="m14.772 18.148.923.383"/><path d="M4.2 15.1a7 7 0 1 1 9.93-9.858A7 7 0 0 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.2"/><path d="m9.228 15.852-.923-.383"/><path d="m9.228 18.148-.923.383"/></svg>
              <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:0.02em;vertical-align:middle">Lutecia Monitoring</span>
            </td>
          </tr>
        </table>
        <p style="color:#9ca3af;font-size:12px;margin:10px 0 2px">Rapport hebdomadaire · ${title}</p>
        <p style="color:#6b7280;font-size:11px;margin:0">${weekLabel} · ${now}</p>
      </div>

      <div style="padding:20px 20px 0">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr>
            <td style="width:33%;padding:4px">
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Total</div>
                <div style="font-size:24px;font-weight:700;color:#111827">${clients.length}</div>
              </div>
            </td>
            <td style="width:33%;padding:4px">
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">OK</div>
                <div style="font-size:24px;font-weight:700;color:#16a34a">${okCount}</div>
              </div>
            </td>
            <td style="width:33%;padding:4px">
              <div style="background:${allOk ? "#f9fafb" : "#fef2f2"};border:1px solid ${allOk ? "#e5e7eb" : "#fecaca"};border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Alertes</div>
                <div style="font-size:24px;font-weight:700;color:${allOk ? "#6b7280" : "#dc2626"}">${alertCount}</div>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding:0 20px 24px">
        <h2 style="font-size:13px;font-weight:600;color:#111827;margin:0 0 12px">Détail des sites</h2>
        ${cards}
      </div>

      <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 20px;text-align:center">
        <p style="margin:0;font-size:11px;color:#9ca3af">Lutecia Monitoring · Rapport hebdomadaire automatique · Lundi 10H</p>
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch SMTP config
    const { data: smtpRow, error: smtpError } = await supabase
      .from("smtp_config")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (smtpError || !smtpRow?.host) {
      return new Response(
        JSON.stringify({ error: "Configuration SMTP non trouvée. Configurez le SMTP dans Paramètres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all clients
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("*");
    if (clientsError) throw clientsError;
    if (!clients?.length) {
      return new Response(
        JSON.stringify({ error: "Aucun client trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all recipients with receive_reports = true
    const { data: allRecipients } = await supabase
      .from("report_recipients")
      .select("*")
      .eq("receive_reports", true);
    const recipients: any[] = allRecipients ?? [];

    // Fetch latest monitoring data for all clients
    const monMap: Record<string, any> = {};
    const dnsMap: Record<string, any> = {};
    const perfMap: Record<string, any> = {};

    await Promise.all(clients.map(async (c: any) => {
      const [mon, dns, perf] = await Promise.all([
        supabase.from("monitoring_results").select("*").eq("client_id", c.id).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("dns_email_results").select("*").eq("client_id", c.id).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("performance_results").select("*").eq("client_id", c.id).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (mon.data) {
        monMap[c.id] = {
          http: mon.data.http_status,
          ssl: mon.data.ssl_status,
          dns: mon.data.dns_status,
          issues: mon.data.issues,
          checkedAt: mon.data.checked_at,
        };
      }
      if (dns.data) dnsMap[c.id] = dns.data;
      if (perf.data) perfMap[c.id] = { desktop: perf.data.desktop_details, mobile: perf.data.mobile_details };
    }));

    const transporter = nodemailer.createTransport({
      host: smtpRow.host,
      port: smtpRow.port ?? 587,
      secure: smtpRow.port === 465,
      auth: { user: smtpRow.smtp_user, pass: smtpRow.smtp_pass },
    });

    const sent: string[] = [];
    const errors: string[] = [];
    const weekLabel = `Semaine du ${(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); })()}`;

    // ── Per-client personalized emails ────────────────────────────────────────
    for (const client of clients) {
      const clientRecipients = recipients.filter(
        (r: any) => r.client_id === client.id && r.receive_reports
      );
      if (clientRecipients.length === 0) continue;

      const html = buildEmailHtml([client], monMap, dnsMap, perfMap, client.name);
      const subject = `Rapport hebdomadaire — ${client.name} · ${weekLabel}`;

      for (const recipient of clientRecipients) {
        try {
          await transporter.sendMail({
            from: `"Lutecia Monitoring" <${smtpRow.smtp_user}>`,
            to: recipient.email,
            subject,
            html,
          });
          sent.push(`${recipient.email} (${client.name})`);
        } catch (err: any) {
          errors.push(`${recipient.email} — ${client.name}: ${err.message}`);
        }
      }
    }

    // ── Global recipients: full summary of all clients ────────────────────────
    const globalRecipients = recipients.filter((r: any) => r.client_id === null && r.receive_reports);
    if (globalRecipients.length > 0) {
      const html = buildEmailHtml(clients, monMap, dnsMap, perfMap, "Tous les sites");
      const subject = `Rapport hebdomadaire — Tous les sites · ${weekLabel}`;

      for (const recipient of globalRecipients) {
        try {
          await transporter.sendMail({
            from: `"Lutecia Monitoring" <${smtpRow.smtp_user}>`,
            to: recipient.email,
            subject,
            html,
          });
          sent.push(`${recipient.email} (global)`);
        } catch (err: any) {
          errors.push(`${recipient.email} — global: ${err.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: sent.length, recipients: sent, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("weekly-report error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
