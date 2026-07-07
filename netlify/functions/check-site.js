const https = require("https");
const http = require("http");
const dns = require("dns").promises;
const tls = require("tls");
const nodemailer = require("nodemailer");
const { createClient } = require("@supabase/supabase-js");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function httpCheck(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(
      url,
      { timeout: 10000, headers: { "User-Agent": "Lutecia-Monitor/1.0" } },
      (res) => {
        const duration = Date.now() - start;
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          statusCode: res.statusCode,
          responseTime: duration,
        });
        res.resume();
      }
    );
    req.on("error", (err) =>
      resolve({ ok: false, statusCode: null, responseTime: null, error: err.message })
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, statusCode: null, responseTime: null, error: "Timeout" });
    });
  });
}

function sslCheck(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      443,
      hostname,
      { servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();
        if (!cert || !cert.valid_to) {
          return resolve({ ok: false, error: "No certificate found" });
        }
        const expiry = new Date(cert.valid_to);
        const now = new Date();
        const daysLeft = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
        resolve({
          ok: daysLeft > 0,
          daysLeft,
          expiry: expiry.toISOString().split("T")[0],
          issuer: cert.issuer?.O || "Unknown",
        });
      }
    );
    socket.on("error", (err) => resolve({ ok: false, error: err.message }));
    socket.setTimeout(8000, () => {
      socket.destroy();
      resolve({ ok: false, error: "SSL timeout" });
    });
  });
}

async function dnsCheck(domain) {
  try {
    const [aRecords, mxRecords] = await Promise.allSettled([
      dns.resolve4(domain),
      dns.resolveMx(domain),
    ]);

    let spfRecord = null;
    try {
      const txtRecords = await dns.resolveTxt(domain);
      const spf = txtRecords.flat().find((r) => r.startsWith("v=spf1"));
      spfRecord = spf || null;
    } catch {}

    return {
      ok: aRecords.status === "fulfilled",
      aRecords:
        aRecords.status === "fulfilled" ? aRecords.value : [],
      mxRecords:
        mxRecords.status === "fulfilled"
          ? mxRecords.value.map((m) => m.exchange)
          : [],
      spf: spfRecord,
      mxOk: mxRecords.status === "fulfilled" && mxRecords.value.length > 0,
    };
  } catch (err) {
    return { ok: false, error: err.message, aRecords: [], mxRecords: [], mxOk: false };
  }
}

// ─── Alert Email ──────────────────────────────────────────────────────────────

async function sendAlert({ client, issues, smtpConfig }) {
  if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) return;

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port || 587,
    secure: smtpConfig.port === 465,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
  });

  const issueList = issues.map((i) => `<li>❌ ${i}</li>`).join("");

  await transporter.sendMail({
    from: `"Lutecia Monitor" <${smtpConfig.user}>`,
    to: smtpConfig.alertTo || smtpConfig.user,
    subject: `⚠️ Alerte Lutecia : problème détecté sur ${client.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#e53e3e">⚠️ Problème détecté</h2>
        <p>Le monitoring a détecté des anomalies sur <strong>${client.name}</strong> (${client.url}) :</p>
        <ul style="line-height:1.8">${issueList}</ul>
        <p style="color:#666;font-size:12px">Lutecia Monitor — ${new Date().toLocaleString("fr-FR")}</p>
      </div>
    `,
  });
}

// ─── Supabase Client ─────────────────────────────────────────────────────────

let supabase = null;
function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
    }
  }
  return supabase;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { client, smtpConfig } = body;
  // client: { name, url, domain }

  if (!client?.url || !client?.domain) {
    return { statusCode: 400, body: "Missing client.url or client.domain" };
  }

  const [http_, ssl_, dns_] = await Promise.all([
    httpCheck(client.url),
    sslCheck(client.domain),
    dnsCheck(client.domain),
  ]);

  const result = {
    name: client.name,
    url: client.url,
    domain: client.domain,
    checkedAt: new Date().toISOString(),
    http: http_,
    ssl: ssl_,
    dns: dns_,
  };

  // Collect issues for alert
  const issues = [];
  if (!http_.ok)
    issues.push(`Site inaccessible (HTTP ${http_.statusCode || "timeout"})`);
  if (!ssl_.ok) issues.push(`SSL invalide ou expiré (${ssl_.error || ssl_.daysLeft + " jours restants"})`);
  else if (ssl_.daysLeft < 14)
    issues.push(`SSL expire dans ${ssl_.daysLeft} jours (${ssl_.expiry})`);
  if (!dns_.ok) issues.push(`DNS non résolu pour ${client.domain}`);
  if (!dns_.mxOk) issues.push(`Aucun enregistrement MX trouvé (emails potentiellement en panne)`);

  if (issues.length > 0 && smtpConfig) {
    try {
      await sendAlert({ client, issues, smtpConfig });
    } catch (err) {
      console.error("Email alert failed:", err.message);
    }
  }

  const supabaseClient = getSupabaseClient();
  if (supabaseClient && client.id) {
    try {
      await supabaseClient.from("monitoring_results").insert({
        client_id: client.id,
        http_status: http_,
        ssl_status: ssl_,
        dns_status: dns_,
        issues,
        checked_at: result.checkedAt,
      });
    } catch (err) {
      console.error("Failed to save result to Supabase:", err.message);
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...result, issues }),
  };
};
