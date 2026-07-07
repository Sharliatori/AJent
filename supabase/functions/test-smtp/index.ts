import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
    const { host, port, user, pass, alertTo } = await req.json();

    if (!host || !user || !pass) {
      return new Response(
        JSON.stringify({ success: false, error: "Serveur SMTP, utilisateur et mot de passe requis." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const to = alertTo || user;

    const transporter = nodemailer.createTransport({
      host,
      port: port ?? 587,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    await transporter.sendMail({
      from: `"Lutecia Monitoring" <${user}>`,
      to,
      subject: "Test SMTP — Lutecia Monitoring",
      html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Test SMTP</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:32px auto;padding:0 16px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08)">
      <div style="background:#0a0c0f;padding:24px 32px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="color:#0EA5E9;font-size:22px">◈</span>
          <span style="color:#fff;font-size:18px;font-weight:700">Lutecia Monitoring</span>
        </div>
        <p style="color:#9ca3af;font-size:12px;margin:0">Configuration SMTP</p>
      </div>
      <div style="padding:24px 32px">
        <div style="font-size:32px;text-align:center;margin-bottom:16px">✓</div>
        <h2 style="text-align:center;font-size:18px;color:#111827;margin:0 0 12px">Configuration SMTP valide !</h2>
        <p style="text-align:center;font-size:13px;color:#6b7280;margin:0">
          Votre serveur SMTP est correctement configuré.<br>
          Les alertes et rapports seront envoyés depuis <strong>${user}</strong>.
        </p>
        <div style="margin-top:20px;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
          <p style="font-size:12px;color:#065f46;margin:0;font-family:monospace">
            Serveur : ${host}:${port ?? 587}
          </p>
        </div>
      </div>
      <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center">
        <p style="margin:0;font-size:11px;color:#9ca3af">Lutecia Monitoring · Test automatique</p>
      </div>
    </div>
  </div>
</body>
</html>`,
    });

    return new Response(
      JSON.stringify({ success: true, to }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const msg: string = err.message || "Erreur inconnue";
    let hint = "";
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      hint = "Vérifiez le nom du serveur SMTP et le port.";
    } else if (msg.includes("535") || msg.includes("authentication") || msg.includes("credentials")) {
      hint = "Identifiants incorrects. Pour Gmail/Outlook, utilisez un mot de passe d'application.";
    } else if (msg.includes("465") || msg.includes("SSL") || msg.includes("TLS")) {
      hint = "Essayez le port 587 (STARTTLS) ou 465 (SSL/TLS).";
    } else if (msg.includes("timeout")) {
      hint = "Timeout — vérifiez que le port est correct et non bloqué par un pare-feu.";
    }
    return new Response(
      JSON.stringify({ success: false, error: msg, hint }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
