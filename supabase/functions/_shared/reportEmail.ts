// Client-facing report: current state, Google PageSpeed scores and recommendations only.
// Deliberately omits incident history and raw alerts so clients are not alarmed.

export interface ReportSite {
  client: { name: string; url: string };
  mon?: { http?: any; ssl?: any; checkedAt?: string } | null;
  dns?: any;
  perf?: { mobile?: any; desktop?: any } | null;
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortHost(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function scoreColors(score: number) {
  if (score >= 90) return { fg: "#047857", bg: "#ecfdf5", ring: "#a7f3d0", label: "Excellent" };
  if (score >= 50) return { fg: "#b45309", bg: "#fffbeb", ring: "#fde68a", label: "Correct" };
  return { fg: "#b91c1c", bg: "#fef2f2", ring: "#fecaca", label: "À améliorer" };
}

function scoreCell(label: string, details: any): string {
  const score = typeof details?.performance === "number" ? details.performance : null;
  const inner = score === null
    ? `<div style="font-size:28px;line-height:34px;font-weight:700;color:#9ca3af">–</div>
       <div style="font-size:12px;line-height:18px;color:#9ca3af">Mesure à venir</div>`
    : (() => {
        const c = scoreColors(score);
        return `<div style="font-size:32px;line-height:38px;font-weight:700;color:${c.fg}">${score}</div>
                <div style="font-size:12px;line-height:18px;color:${c.fg};font-weight:600">${c.label}</div>`;
      })();
  const c = score === null ? { bg: "#f9fafb", ring: "#e5e7eb" } : scoreColors(score);
  return `<td width="50%" valign="top" style="padding:4px">
    <div style="background:${c.bg};border:1px solid ${c.ring};border-radius:12px;padding:14px 8px;text-align:center">
      <div style="font-size:12px;line-height:18px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">${label}</div>
      ${inner}
    </div>
  </td>`;
}

function stateRow(label: string, value: string, ok: boolean | null): string {
  const dot = ok === null ? "#9ca3af" : ok ? "#10b981" : "#f59e0b";
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:15px;line-height:22px;color:#374151">${label}</td>
    <td align="right" style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:15px;line-height:22px;color:#111827;font-weight:600;white-space:nowrap">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot};margin-right:6px;vertical-align:middle"></span>${value}
    </td>
  </tr>`;
}

function buildRecommendations(site: ReportSite): string[] {
  const recs: string[] = [];
  const opps: any[] = site.perf?.mobile?.opportunities ?? site.perf?.desktop?.opportunities ?? [];
  for (const o of opps.slice(0, 3)) {
    if (o?.title) recs.push(o.savings ? `${o.title} (gain estimé : ${o.savings})` : o.title);
  }

  const mobileScore = site.perf?.mobile?.performance;
  if (!opps.length && typeof mobileScore === "number" && mobileScore < 90) {
    recs.push("Optimiser le poids des images et différer les scripts non essentiels pour accélérer l'affichage sur mobile.");
  }

  const days = site.mon?.ssl?.daysLeft;
  if (typeof days === "number" && days >= 0 && days < 30) {
    recs.push(`Renouvellement du certificat de sécurité à prévoir (expire dans ${days} jours) — nous nous en occupons.`);
  }

  const dns = site.dns;
  if (dns) {
    if (dns.dns_spf && !dns.dns_spf.ok) recs.push("Ajouter un enregistrement SPF pour améliorer la délivrabilité de vos emails.");
    if (dns.dns_dmarc && !dns.dns_dmarc.ok) recs.push("Mettre en place une politique DMARC pour protéger votre nom de domaine contre l'usurpation.");
  }
  return recs.slice(0, 5);
}

function siteCard(site: ReportSite): string {
  const { client, mon, dns, perf } = site;
  const httpOk = mon?.http ? (mon.http.ok ?? mon.http.success ?? null) : null;
  const sslOk = mon?.ssl ? (mon.ssl.ok ?? mon.ssl.success ?? null) : null;
  const days = mon?.ssl?.daysLeft;
  const dnsOk = dns ? [dns.dns_mx?.ok, dns.dns_spf?.ok, dns.dns_dmarc?.ok].filter(Boolean).length >= 2 : null;

  const onlineValue = httpOk === null ? "Non vérifié" : httpOk ? "En ligne" : "Vérification en cours";
  const sslValue = sslOk === null ? "Non vérifié" : sslOk ? (typeof days === "number" ? `Actif · ${days} j` : "Actif") : "À renouveler";
  const dnsValue = dnsOk === null ? "Non vérifié" : dnsOk ? "Configurée" : "À optimiser";

  const recs = buildRecommendations(site);
  const recsHtml = recs.length
    ? `<div style="margin-top:20px">
        <div style="font-size:13px;line-height:20px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Recommandations</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          ${recs.map((r, i) => `<tr>
            <td valign="top" width="28" style="padding:6px 0">
              <div style="width:22px;height:22px;border-radius:50%;background:#e0f2fe;color:#0369a1;font-size:12px;line-height:22px;font-weight:700;text-align:center">${i + 1}</div>
            </td>
            <td style="padding:6px 0 6px 6px;font-size:15px;line-height:22px;color:#374151">${esc(r)}</td>
          </tr>`).join("")}
        </table>
      </div>`
    : `<div style="margin-top:20px;padding:12px 14px;background:#ecfdf5;border-radius:10px;font-size:15px;line-height:22px;color:#065f46">Aucune action nécessaire — votre site est en excellente santé.</div>`;

  return `<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:20px;margin-bottom:16px">
    <div style="font-size:18px;line-height:24px;font-weight:700;color:#111827">${esc(client.name)}</div>
    <div style="font-size:14px;line-height:20px;color:#6b7280;margin-bottom:16px;word-break:break-all">${esc(shortHost(client.url))}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      ${stateRow("Disponibilité", onlineValue, httpOk)}
      ${stateRow("Sécurité (HTTPS)", sslValue, sslOk)}
      ${stateRow("Configuration email", dnsValue, dnsOk)}
    </table>

    <div style="font-size:13px;line-height:20px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px">Score Google PageSpeed</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <tr>${scoreCell("Mobile", perf?.mobile)}${scoreCell("Ordinateur", perf?.desktop)}</tr>
    </table>
    ${recsHtml}
  </div>`;
}

export function buildReportEmail(sites: ReportSite[], subtitle: string, footer: string): string {
  const now = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const cards = sites.map(siteCard).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Rapport Lutecia</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:${FONT};-webkit-text-size-adjust:100%">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6">
    <tr><td align="center" style="padding:16px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:#0a0c0f;border-radius:14px 14px 0 0;padding:24px 20px">
          <div style="font-size:20px;line-height:26px;font-weight:700;color:#ffffff">Lutecia Monitoring</div>
          <div style="font-size:15px;line-height:22px;color:#d1d5db;margin-top:6px">${esc(subtitle)}</div>
          <div style="font-size:13px;line-height:20px;color:#9ca3af;margin-top:2px">${now}</div>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 12px 4px">
          ${cards}
        </td></tr>
        <tr><td style="background:#f9fafb;border-radius:0 0 14px 14px;border-top:1px solid #e5e7eb;padding:16px 20px;text-align:center">
          <div style="font-size:13px;line-height:20px;color:#6b7280">${esc(footer)}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
