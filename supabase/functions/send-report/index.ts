import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function buildEmailHtml(clients: any[], results: Record<string, any>, dnsResults: Record<string, any>, perfResults: Record<string, any>, clientName?: string): string {
  const now = new Date().toLocaleString("fr-FR");
  const allOk = clients.every((c) => !results[c.id]?.issues?.length);

  const statusBadge = (ok: boolean, label: string) =>
    `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;background:${ok ? "#d1fae5" : "#fee2e2"};color:${ok ? "#065f46" : "#991b1b"}">${label}</span>`;

  const warnBadge = (label: string) =>
    `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;background:#fef3c7;color:#92400e">${label}</span>`;

  const idleBadge = (label: string) =>
    `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;background:#f3f4f6;color:#6b7280">${label}</span>`;

  const rows = clients.map((c) => {
    const r = results[c.id];
    const dns = dnsResults[c.id];
    const perf = perfResults[c.id];
    if (!r) return `<tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb"><strong>${c.name}</strong><br><small style="color:#9ca3af">${c.url}</small></td><td colspan="4" style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#9ca3af">Non verifie</td></tr>`;

    const hasIssues = r.issues?.length > 0;
    const dnsEmailOk = dns ? [dns.dns_mx?.ok, dns.dns_spf?.ok, dns.dns_dmarc?.ok].filter(Boolean).length >= 2 : null;
    const perfScore = perf?.desktop?.performance ?? perf?.desktop?.score ?? perf?.mobile?.performance ?? perf?.mobile?.score;
    const secScore = r.http?.securityScore;

    const issuesList = hasIssues ? `<ul style="margin:8px 0 0;padding:0 0 0 16px">${r.issues.map((i: string) => `<li style="color:#dc2626;font-size:12px;margin:2px 0">${i}</li>`).join("")}</ul>` : "";

    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top">
          <strong style="color:#111827">${c.name}</strong><br>
          <small style="color:#9ca3af">${c.url}</small>
          ${issuesList}
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top">${hasIssues ? (r.issues.length > 1 ? statusBadge(false, "Erreur") : warnBadge("Attention")) : statusBadge(true, "OK")}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top">${dnsEmailOk !== null ? statusBadge(dnsEmailOk, dnsEmailOk ? "OK" : "Attention") : idleBadge("N/A")}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top">${perfScore !== undefined ? (perfScore >= 80 ? statusBadge(true, `${perfScore}/100`) : perfScore >= 50 ? warnBadge(`${perfScore}/100`) : statusBadge(false, `${perfScore}/100`)) : idleBadge("N/A")}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top">${secScore !== undefined ? (secScore >= 80 ? statusBadge(true, `${secScore}/100`) : secScore >= 40 ? warnBadge(`${secScore}/100`) : statusBadge(false, `${secScore}/100`)) : idleBadge("N/A")}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport Lutecia</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:700px;margin:32px auto;padding:0 16px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08)">
      <div style="background:#0a0c0f;padding:32px 40px 28px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="m10.852 19.772-.383.924"/><path d="m13.148 14.228.383-.923"/><path d="M13.148 19.772a3 3 0 1 0-2.296-5.544l-.383-.923"/><path d="m13.53 20.696-.382-.924a3 3 0 1 1-2.296-5.544"/><path d="m14.772 15.852.923-.383"/><path d="m14.772 18.148.923.383"/><path d="M4.2 15.1a7 7 0 1 1 9.93-9.858A7 7 0 0 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.2"/><path d="m9.228 15.852-.923-.383"/><path d="m9.228 18.148-.923.383"/></svg>
          <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:0.02em">Lutecia Monitoring</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;margin:0">Rapport de surveillance${clientName ? ` — ${clientName}` : ""} · Generé le ${now}</p>
      </div>

      <div style="padding:28px 40px 0">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Total sites</div>
            <div style="font-size:28px;font-weight:700;color:#111827">${clients.length}</div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Operationnels</div>
            <div style="font-size:28px;font-weight:700;color:#16a34a">${clients.filter(c => !results[c.id]?.issues?.length && results[c.id]).length}</div>
          </div>
          <div style="background:${allOk ? "#f9fafb" : "#fef2f2"};border:1px solid ${allOk ? "#e5e7eb" : "#fecaca"};border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Avec alertes</div>
            <div style="font-size:28px;font-weight:700;color:${allOk ? "#6b7280" : "#dc2626"}">${clients.filter(c => results[c.id]?.issues?.length > 0).length}</div>
          </div>
        </div>
      </div>

      <div style="padding:0 40px 32px">
        <h2 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 16px">Details des sites</h2>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb">
                <th style="text-align:left;padding:10px 16px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap">Site</th>
                <th style="text-align:left;padding:10px 16px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em">Status</th>
                <th style="text-align:left;padding:10px 16px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em">Email DNS</th>
                <th style="text-align:left;padding:10px 16px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em">Perf PC</th>
                <th style="text-align:left;padding:10px 16px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em">Sécurité</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>

      <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center">
        <p style="margin:0;font-size:12px;color:#9ca3af">Lutecia Monitoring · Rapport automatique</p>
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

    const body = await req.json().catch(() => ({}));
    const targetClientId: string | undefined = body.client_id;

    // Fetch SMTP config
    const { data: smtpRow, error: smtpError } = await supabase
      .from("smtp_config")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (smtpError || !smtpRow?.host) {
      return new Response(
        JSON.stringify({ error: "Configuration SMTP non trouvee. Veuillez configurer le SMTP dans Parametres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch clients
    const clientsQuery = supabase.from("clients").select("*");
    if (targetClientId) clientsQuery.eq("id", targetClientId);
    const { data: clients, error: clientsError } = await clientsQuery;
    if (clientsError) throw clientsError;
    if (!clients?.length) {
      return new Response(
        JSON.stringify({ error: "Aucun client trouve" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch recipients
    const recipientsQuery = supabase
      .from("report_recipients")
      .select("*")
      .eq("receive_reports", true);
    const { data: allRecipients } = await recipientsQuery;
    const recipients = allRecipients ?? [];

    if (recipients.length === 0 && !smtpRow.alert_to) {
      return new Response(
        JSON.stringify({ error: "Aucun destinataire configure. Ajoutez des destinataires dans l'onglet Destinataires." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch latest results for each client
    const results: Record<string, any> = {};
    const dnsResults: Record<string, any> = {};
    const perfResults: Record<string, any> = {};

    await Promise.all(clients.map(async (c: any) => {
      const [mon, dns, perf] = await Promise.all([
        supabase.from("monitoring_results").select("*").eq("client_id", c.id).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("dns_email_results").select("*").eq("client_id", c.id).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("performance_results").select("*").eq("client_id", c.id).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (mon.data) results[c.id] = { ...mon.data.http_status, http: mon.data.http_status, ssl: mon.data.ssl_status, dns: mon.data.dns_status, issues: mon.data.issues, checkedAt: mon.data.checked_at };
      if (dns.data) dnsResults[c.id] = dns.data;
      if (perf.data) perfResults[c.id] = { desktop: perf.data.desktop_details, mobile: perf.data.mobile_details };
    }));

    // Build transporter
    const transporter = nodemailer.createTransport({
      host: smtpRow.host,
      port: smtpRow.port ?? 587,
      secure: smtpRow.port === 465,
      auth: { user: smtpRow.smtp_user, pass: smtpRow.smtp_pass },
    });

    // Determine final recipient list
    const emailSet = new Set<string>();
    recipients.forEach((r: any) => {
      // Global send: include ALL recipients (every client + global)
      // Targeted send: include global recipients + recipients of the specific client only
      if (!targetClientId || !r.client_id || r.client_id === targetClientId) {
        emailSet.add(r.email);
      }
    });
    if (smtpRow.alert_to) emailSet.add(smtpRow.alert_to);

    const toList = Array.from(emailSet);
    if (toList.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucun destinataire pour ce client." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientName = targetClientId ? clients[0]?.name : undefined;
    const htmlBody = buildEmailHtml(clients, results, dnsResults, perfResults, clientName);
    const subject = targetClientId
      ? `Rapport Lutecia — ${clientName} · ${new Date().toLocaleDateString("fr-FR")}`
      : `Rapport Lutecia — Tous les sites · ${new Date().toLocaleDateString("fr-FR")}`;

    const sent: string[] = [];
    const errors: string[] = [];

    for (const to of toList) {
      try {
        await transporter.sendMail({
          from: `"Lutecia Monitoring" <${smtpRow.smtp_user}>`,
          to,
          subject,
          html: htmlBody,
        });
        sent.push(to);
      } catch (err: any) {
        errors.push(`${to}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ sent: sent.length, recipients: sent, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("send-report error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
