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
    const sites = clients.map((c: any) => ({ client: c, mon: results[c.id], dns: dnsResults[c.id], perf: perfResults[c.id] }));
    const subtitle = clientName ? `Rapport de santé — ${clientName}` : "Rapport de santé de vos sites";
    const footer = "Lutecia Monitoring · Surveillance continue de vos sites";
    const clientHtml = buildReportEmail(sites, subtitle, footer);
    const adminHtml = buildReportEmail(sites, subtitle, footer, true);
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
          html: to === smtpRow.alert_to ? adminHtml : clientHtml,
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
