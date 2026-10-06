import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@9";
import { buildReportEmail } from "../_shared/reportEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};


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

      const html = buildReportEmail(
        [{ client, mon: monMap[client.id], dns: dnsMap[client.id], perf: perfMap[client.id] }],
        `Rapport hebdomadaire — ${client.name}`,
        "Lutecia Monitoring · Rapport hebdomadaire · chaque lundi"
      );
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
      const html = buildReportEmail(
        clients.map((c: any) => ({ client: c, mon: monMap[c.id], dns: dnsMap[c.id], perf: perfMap[c.id] })),
        "Rapport hebdomadaire — Tous les sites",
        "Lutecia Monitoring · Rapport hebdomadaire · chaque lundi"
      );
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
