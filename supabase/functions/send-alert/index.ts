import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@9";

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
    const { client_id, client_name, client_url, issues, checked_at } = await req.json();

    if (!client_id || !issues?.length) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No issues or missing client_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check debounce: was an alert sent for this client in the last 24h?
    const { data: clientRow } = await supabase
      .from("clients")
      .select("last_alert_sent_at")
      .eq("id", client_id)
      .maybeSingle();

    if (clientRow?.last_alert_sent_at) {
      const lastAlert = new Date(clientRow.last_alert_sent_at);
      const hoursSince = (Date.now() - lastAlert.getTime()) / 3600000;
      if (hoursSince < 24) {
        return new Response(
          JSON.stringify({ skipped: true, reason: `Alert already sent ${Math.floor(hoursSince)}h ago` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch SMTP config
    const { data: smtpRow } = await supabase
      .from("smtp_config")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!smtpRow?.host) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No SMTP config" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch recipients for this client (specific + global)
    const { data: recipients } = await supabase
      .from("report_recipients")
      .select("email")
      .eq("receive_alerts", true)
      .or(`client_id.eq.${client_id},client_id.is.null`);

    const emailSet = new Set<string>();
    (recipients ?? []).forEach((r: any) => emailSet.add(r.email));
    if (smtpRow.alert_to) emailSet.add(smtpRow.alert_to);

    if (emailSet.size === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No alert recipients" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ts = new Date(checked_at ?? Date.now()).toLocaleString("fr-FR");
    const issueItems = issues.map((i: string) => `<li style="margin:6px 0;color:#dc2626">${i}</li>`).join("");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Alerte Lutecia</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;padding:0 16px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08)">
      <div style="background:#dc2626;padding:24px 32px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="color:#fff;font-size:20px">⚠</span>
          <span style="color:#fff;font-size:18px;font-weight:700">Alerte — ${client_name}</span>
        </div>
        <p style="color:#fca5a5;font-size:12px;margin:0">Détectée le ${ts}</p>
      </div>
      <div style="padding:24px 32px">
        <p style="color:#374151;font-size:14px;margin:0 0 16px">
          Des problèmes ont été détectés sur <strong>${client_url ?? client_name}</strong> :
        </p>
        <ul style="margin:0;padding:0 0 0 20px;font-size:14px">
          ${issueItems}
        </ul>
      </div>
      <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center">
        <p style="margin:0;font-size:12px;color:#9ca3af">Lutecia Monitoring · Alerte automatique</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const transporter = nodemailer.createTransport({
      host: smtpRow.host,
      port: smtpRow.port ?? 587,
      secure: smtpRow.port === 465,
      auth: { user: smtpRow.smtp_user, pass: smtpRow.smtp_pass },
    });

    const toList = Array.from(emailSet);
    const sent: string[] = [];
    const errors: string[] = [];

    for (const to of toList) {
      try {
        await transporter.sendMail({
          from: `"Lutecia Monitoring" <${smtpRow.smtp_user}>`,
          to,
          subject: `[ALERTE] ${client_name} — ${issues.length} problème${issues.length > 1 ? "s" : ""} détecté${issues.length > 1 ? "s" : ""}`,
          html,
        });
        sent.push(to);
      } catch (err: any) {
        errors.push(`${to}: ${err.message}`);
      }
    }

    // Update last_alert_sent_at on the client to prevent spam
    if (sent.length > 0) {
      await supabase
        .from("clients")
        .update({ last_alert_sent_at: new Date().toISOString() })
        .eq("id", client_id);
    }

    return new Response(
      JSON.stringify({ sent: sent.length, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("send-alert error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
