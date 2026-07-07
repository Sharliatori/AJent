import { useState } from "react";
import { CloudCog } from "lucide-react";
import { recipientsService, dailySnapshotService } from "../lib/supabase";

export default function ReportView({
  clients,
  results,
  dnsResults,
  perfResults,
  loading,
  dnsLoading,
  perfLoading,
  smtpConfig,
  onCheck,
  onCheckDns,
  onCheckPerf,
}) {
  const [analysisLoading, setAnalysisLoading] = useState({});
  const [emailLoading, setEmailLoading] = useState({});
  const [emailResult, setEmailResult] = useState({});
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyResult, setWeeklyResult] = useState(null);

  const hasData = Object.keys(results).length > 0;
  const hasSmtp = smtpConfig?.host && smtpConfig?.user;

  const stats = {
    total: clients.length,
    checked: Object.keys(results).length,
    ok: Object.values(results).filter((r) => !r.issues || r.issues.length === 0).length,
    warnings: Object.values(results).filter((r) => r.issues && r.issues.length === 1).length,
    errors: Object.values(results).filter((r) => r.issues && r.issues.length > 1).length,
    avgResponseTime:
      Object.values(results).filter((r) => r.http?.responseTime).reduce((s, r) => s + (r.http.responseTime || 0), 0) /
      (Object.values(results).filter((r) => r.http?.responseTime).length || 1),
    avgSecurityScore:
      Object.values(results).filter((r) => r.http?.securityScore !== undefined).reduce((s, r) => s + (r.http.securityScore || 0), 0) /
      (Object.values(results).filter((r) => r.http?.securityScore !== undefined).length || 1),
  };

  const runFullAnalysis = async (client) => {
    setAnalysisLoading((s) => ({ ...s, [client.id]: true }));
    try {
      await Promise.all([onCheck(client), onCheckDns(client), onCheckPerf(client)]);
    } finally {
      setAnalysisLoading((s) => ({ ...s, [client.id]: false }));
    }
  };

  const sendEmailForClient = async (clientId) => {
    setEmailLoading((s) => ({ ...s, [clientId]: true }));
    setEmailResult((s) => ({ ...s, [clientId]: null }));
    try {
      const data = await recipientsService.sendReport(clientId);
      setEmailResult((s) => ({
        ...s,
        [clientId]: { ok: true, message: `Envoyé à ${data.sent} destinataire${data.sent > 1 ? "s" : ""}` },
      }));
    } catch (err) {
      setEmailResult((s) => ({ ...s, [clientId]: { ok: false, message: err.message } }));
    } finally {
      setEmailLoading((s) => ({ ...s, [clientId]: false }));
    }
  };

  const sendEmailAll = async () => {
    setEmailLoading((s) => ({ ...s, _all: true }));
    setEmailResult((s) => ({ ...s, _all: null }));
    try {
      const data = await recipientsService.sendReport(null);
      setEmailResult((s) => ({
        ...s,
        _all: { ok: true, message: `Rapport global envoyé à ${data.sent} destinataire${data.sent > 1 ? "s" : ""}` },
      }));
    } catch (err) {
      setEmailResult((s) => ({ ...s, _all: { ok: false, message: err.message } }));
    } finally {
      setEmailLoading((s) => ({ ...s, _all: false }));
    }
  };

  const sendWeeklyReport = async () => {
    setWeeklyLoading(true);
    setWeeklyResult(null);
    try {
      const data = await dailySnapshotService.triggerWeeklyReport();
      setWeeklyResult({
        ok: true,
        message: `Rapport hebdomadaire envoyé à ${data.sent} destinataire${data.sent > 1 ? "s" : ""}`,
      });
    } catch (err) {
      setWeeklyResult({ ok: false, message: err.message });
    } finally {
      setWeeklyLoading(false);
    }
  };

  const getHttpBadge = (http) => {
    if (!http) return { cls: "error", label: "N/A" };
    const ok = http.ok ?? http.success;
    const code = http.statusCode ?? http.status;
    if (!ok && !code) return { cls: "error", label: "TIMEOUT" };
    if (!ok) return { cls: "error", label: `${code}` };
    return { cls: "ok", label: `${code}` };
  };

  const getSslBadge = (ssl) => {
    if (!ssl) return { cls: "error", label: "N/A" };
    const ok = ssl.ok ?? ssl.success;
    if (!ok) return { cls: "error", label: "INVALIDE" };
    if (ssl.daysLeft && ssl.daysLeft < 14) return { cls: "warn", label: `${ssl.daysLeft}j` };
    if (ssl.daysLeft) return { cls: "ok", label: `${ssl.daysLeft}j` };
    return { cls: "ok", label: "VALIDE" };
  };

  const getDnsBadge = (dns) => {
    if (!dns) return { cls: "error", label: "N/A" };
    const ok = dns.ok ?? dns.success;
    return ok ? { cls: "ok", label: "OK" } : { cls: "error", label: "ERREUR" };
  };

  const getSecurityBadge = (http) => {
    if (!http || http.securityScore === undefined) return null;
    const score = http.securityScore;
    if (score >= 80) return { cls: "ok", label: `${score}/100` };
    if (score >= 40) return { cls: "warn", label: `${score}/100` };
    return { cls: "error", label: `${score}/100` };
  };

  const getEmailDnsBadge = (dns) => {
    if (!dns) return null;
    const checks = [dns.mxOk, dns.spfOk, dns.dmarcOk, dns.dkimOk].filter(Boolean).length;
    if (checks === 4) return { cls: "ok", label: `${checks}/4` };
    if (checks >= 2) return { cls: "warn", label: `${checks}/4` };
    return { cls: "error", label: `${checks}/4` };
  };

  const getPerfBadge = (perf) => {
    if (!perf) return null;
    const score = perf.desktop?.score ?? perf.mobile?.score ?? perf.desktopScore ?? perf.mobileScore;
    if (score === undefined || score === null) return null;
    if (score >= 80) return { cls: "ok", label: `${score}` };
    if (score >= 50) return { cls: "warn", label: `${score}` };
    return { cls: "error", label: `${score}` };
  };

  const isClientLoading = (clientId) =>
    loading[clientId] || dnsLoading[clientId] || perfLoading[clientId] || analysisLoading[clientId];

  const exportHTML = () => {
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport Lutecia - ${new Date().toLocaleDateString("fr-FR")}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 40px 20px; }
    .container { max-width: 1100px; margin: auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.08); }
    .header { border-bottom: 2px solid #0EA5E9; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; color: #0a0c0f; margin-bottom: 8px; }
    .date { color: #666; font-size: 14px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 40px; }
    .stat { background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .stat-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .stat-value { font-size: 28px; font-weight: 600; color: #0a0c0f; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
    thead { background: #f9fafb; }
    th { text-align: left; padding: 12px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge.ok { background: #d1fae5; color: #065f46; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.error { background: #fee2e2; color: #991b1b; }
    .badge.idle { background: #f3f4f6; color: #6b7280; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.852 19.772-.383.924"/><path d="m13.148 14.228.383-.923"/><path d="M13.148 19.772a3 3 0 1 0-2.296-5.544l-.383-.923"/><path d="m13.53 20.696-.382-.924a3 3 0 1 1-2.296-5.544"/><path d="m14.772 15.852.923-.383"/><path d="m14.772 18.148.923.383"/><path d="M4.2 15.1a7 7 0 1 1 9.93-9.858A7 7 0 0 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.2"/><path d="m9.228 15.852-.923-.383"/><path d="m9.228 18.148-.923.383"/></svg>
        <h1 style="margin:0">Lutecia — Rapport de Monitoring</h1>
      </div>
      <div class="date">Généré le ${new Date().toLocaleString("fr-FR")}</div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-label">Total</div><div class="stat-value">${stats.total}</div></div>
      <div class="stat"><div class="stat-label">Opérationnels</div><div class="stat-value" style="color:#10b981">${stats.ok}</div></div>
      <div class="stat"><div class="stat-label">Avertissements</div><div class="stat-value" style="color:#f59e0b">${stats.warnings}</div></div>
      <div class="stat"><div class="stat-label">Erreurs</div><div class="stat-value" style="color:#ef4444">${stats.errors}</div></div>
      <div class="stat"><div class="stat-label">Temps moy.</div><div class="stat-value">${Math.round(stats.avgResponseTime)}ms</div></div>
    </div>
    <table>
      <thead><tr><th>Site</th><th>Status</th><th>HTTP</th><th>SSL</th><th>DNS</th><th>Sécurité</th><th>Email DNS</th><th>Perf</th></tr></thead>
      <tbody>${clients.map((client) => {
        const r = results[client.id];
        const dns = dnsResults?.[client.id];
        const perf = perfResults?.[client.id];
        if (!r) return `<tr><td><strong>${client.name}</strong></td><td colspan="7" style="color:#9ca3af">Non vérifié</td></tr>`;
        const hasIssues = r.issues?.length > 0;
        const httpB = getHttpBadge(r.http);
        const sslB = getSslBadge(r.ssl);
        const dnsB = getDnsBadge(r.dns);
        const secB = getSecurityBadge(r.http);
        const emlB = getEmailDnsBadge(dns);
        const perfB = getPerfBadge(perf);
        return `<tr>
          <td><strong>${client.name}</strong><br><small style="color:#9ca3af">${client.url}</small></td>
          <td><span class="badge ${hasIssues ? (r.issues.length > 1 ? "error" : "warn") : "ok"}">${hasIssues ? (r.issues.length > 1 ? "Erreur" : "Attention") : "OK"}</span></td>
          <td><span class="badge ${httpB.cls}">${httpB.label}</span></td>
          <td><span class="badge ${sslB.cls}">${sslB.label}</span></td>
          <td><span class="badge ${dnsB.cls}">${dnsB.label}</span></td>
          <td>${secB ? `<span class="badge ${secB.cls}">${secB.label}</span>` : "-"}</td>
          <td>${emlB ? `<span class="badge ${emlB.cls}">${emlB.label}</span>` : "-"}</td>
          <td>${perfB ? `<span class="badge ${perfB.cls}">${perfB.label}</span>` : "-"}</td>
        </tr>${hasIssues ? `<tr><td colspan="8"><ul style="margin:4px 0 8px 16px">${r.issues.map((i) => `<li style="color:#ef4444;font-size:12px">${i}</li>`).join("")}</ul></td></tr>` : ""}`;
      }).join("")}
      </tbody>
    </table>
    <div class="footer">Rapport Lutecia Monitoring Dashboard</div>
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lutecia-rapport-${new Date().toISOString().split("T")[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* ─── Header ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <CloudCog size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <h2 style={{ fontFamily: "var(--mono)", fontSize: 14, letterSpacing: "0.08em", color: "var(--text2)", margin: 0 }}>
            RAPPORT DE MONITORING
          </h2>
        </div>
        <button className="btn btn-secondary" onClick={() => window.print()} disabled={!hasData}>
          Imprimer
        </button>
        <button className="btn btn-secondary" onClick={exportHTML} disabled={!hasData}>
          Exporter HTML
        </button>
        <button
          className="btn btn-secondary"
          onClick={sendWeeklyReport}
          disabled={!hasSmtp || weeklyLoading}
          title={!hasSmtp ? "Configurez le SMTP dans Paramètres" : "Envoie le rapport hebdomadaire personnalisé à chaque destinataire"}
        >
          {weeklyLoading ? <><span className="spinner" /> Envoi...</> : "Rapport hebdomadaire"}
        </button>
        <button
          className="btn btn-primary"
          onClick={sendEmailAll}
          disabled={!hasData || !hasSmtp || emailLoading._all}
          title={!hasSmtp ? "Configurez le SMTP dans Paramètres" : ""}
        >
          {emailLoading._all ? <><span className="spinner" /> Envoi...</> : "Envoyer par email"}
        </button>
      </div>

      {weeklyResult && (
        <div className="card" style={{
          marginBottom: 16,
          background: weeklyResult.ok ? "rgba(0,212,168,0.05)" : "rgba(239,68,68,0.05)",
          borderColor: weeklyResult.ok ? "rgba(0,212,168,0.25)" : "rgba(239,68,68,0.25)",
        }}>
          <p style={{ fontSize: 13, color: weeklyResult.ok ? "var(--ok)" : "var(--danger)", margin: 0 }}>
            {weeklyResult.ok ? "✓" : "✗"} {weeklyResult.message}
          </p>
        </div>
      )}

      {emailResult._all && (
        <div className="card" style={{
          marginBottom: 16,
          background: emailResult._all.ok ? "rgba(0,212,168,0.05)" : "rgba(239,68,68,0.05)",
          borderColor: emailResult._all.ok ? "rgba(0,212,168,0.25)" : "rgba(239,68,68,0.25)",
        }}>
          <p style={{ fontSize: 13, color: emailResult._all.ok ? "var(--ok)" : "var(--danger)", margin: 0 }}>
            {emailResult._all.ok ? "✓" : "✗"} {emailResult._all.message}
          </p>
        </div>
      )}

      {!hasData ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text3)", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12, color: "var(--accent)" }}>◈</div>
          <p style={{ fontSize: 14 }}>Aucune donnée disponible. Lancez une analyse ci-dessous ou depuis l'onglet Monitoring.</p>
        </div>
      ) : (
        <>
          {/* ─── Global stats ─── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 32 }}>
            {[
              { label: "TOTAL SITES", value: stats.total, color: "var(--text1)" },
              { label: "OPÉRATIONNELS", value: stats.ok, color: "var(--ok)" },
              { label: "AVERTISSEMENTS", value: stats.warnings, color: "var(--warn)" },
              { label: "ERREURS", value: stats.errors, color: stats.errors > 0 ? "var(--danger)" : "var(--text3)" },
              { label: "TEMPS REPONSE MOY.", value: `${Math.round(stats.avgResponseTime)}ms`, color: "var(--text1)" },
              { label: "SECURITE MOY.", value: Math.round(stats.avgSecurityScore), color: stats.avgSecurityScore >= 60 ? "var(--ok)" : stats.avgSecurityScore >= 40 ? "var(--warn)" : "var(--danger)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card">
                <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--mono)", color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* ─── Summary table ─── */}
          <div className="card" style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 20, fontSize: 14, fontWeight: 600 }}>Details des Sites</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "var(--mono)" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border2)" }}>
                    {["SITE", "STATUS", "HTTP", "SSL", "DNS", "SECURITE", "EMAIL DNS", "PERF", "VERIFIE"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: 12, color: "var(--text3)", fontSize: 11, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const r = results[client.id];
                    const dns = dnsResults?.[client.id];
                    const perf = perfResults?.[client.id];
                    if (!r) return (
                      <tr key={client.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: 12 }}><div style={{ fontWeight: 600 }}>{client.name}</div><div style={{ fontSize: 11, color: "var(--text3)" }}>{client.url}</div></td>
                        <td colSpan={8} style={{ padding: 12, color: "var(--text3)" }}>Non verifie</td>
                      </tr>
                    );
                    const hasIssues = r.issues?.length > 0;
                    const httpB = getHttpBadge(r.http);
                    const sslB = getSslBadge(r.ssl);
                    const dnsB = getDnsBadge(r.dns);
                    const secB = getSecurityBadge(r.http);
                    const emlB = getEmailDnsBadge(dns);
                    const perfB = getPerfBadge(perf);
                    return (
                      <tr key={client.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: 12 }}><div style={{ fontWeight: 600 }}>{client.name}</div><div style={{ fontSize: 11, color: "var(--text3)" }}>{client.url}</div></td>
                        <td style={{ padding: 12 }}><span className={`badge badge-${hasIssues ? (r.issues.length > 1 ? "error" : "warn") : "ok"}`}>{hasIssues ? (r.issues.length > 1 ? "ERREUR" : "ATTENTION") : "OK"}</span></td>
                        <td style={{ padding: 12 }}><span className={`badge badge-${httpB.cls}`}>{httpB.label}</span></td>
                        <td style={{ padding: 12 }}><span className={`badge badge-${sslB.cls}`}>{sslB.label}</span></td>
                        <td style={{ padding: 12 }}><span className={`badge badge-${dnsB.cls}`}>{dnsB.label}</span></td>
                        <td style={{ padding: 12 }}>{secB ? <span className={`badge badge-${secB.cls}`}>{secB.label}</span> : "-"}</td>
                        <td style={{ padding: 12 }}>{emlB ? <span className={`badge badge-${emlB.cls}`}>{emlB.label}</span> : "-"}</td>
                        <td style={{ padding: 12 }}>{perfB ? <span className={`badge badge-${perfB.cls}`}>{perfB.label}</span> : "-"}</td>
                        <td style={{ padding: 12, color: "var(--text2)", fontSize: 11 }}>{new Date(r.checkedAt).toLocaleTimeString("fr-FR")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─── Per-client analysis cards ─── */}
      <div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 13, letterSpacing: "0.08em", color: "var(--text2)", marginBottom: 16 }}>
          ANALYSE PAR CLIENT
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {clients.map((client) => {
            const r = results[client.id];
            const dns = dnsResults?.[client.id];
            const perf = perfResults?.[client.id];
            const busy = isClientLoading(client.id);
            const hasIssues = r?.issues?.length > 0;
            const er = emailResult[client.id];

            return (
              <div key={client.id} className="card" style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{client.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{client.domain}</div>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {r ? (
                      <>
                        <span className={`badge badge-${hasIssues ? (r.issues.length > 1 ? "error" : "warn") : "ok"}`} style={{ fontSize: 11 }}>
                          {hasIssues ? `${r.issues.length} alerte${r.issues.length > 1 ? "s" : ""}` : "Monitoring OK"}
                        </span>
                        {dns && <span className={`badge badge-${dns.overall_score >= 75 ? "ok" : dns.overall_score >= 50 ? "warn" : "error"}`} style={{ fontSize: 11 }}>DNS {dns.overall_score ?? "?"}%</span>}
                        {perf && (perf.desktop?.score !== undefined || perf.mobile?.score !== undefined) && (
                          <span className={`badge badge-${(perf.desktop?.score ?? perf.mobile?.score) >= 80 ? "ok" : (perf.desktop?.score ?? perf.mobile?.score) >= 50 ? "warn" : "error"}`} style={{ fontSize: 11 }}>
                            Perf {perf.desktop?.score ?? perf.mobile?.score}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="badge" style={{ fontSize: 11, background: "var(--bg3)", color: "var(--text3)" }}>Non analysé</span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: "5px 14px" }}
                      onClick={() => runFullAnalysis(client)}
                      disabled={busy}
                    >
                      {busy ? <><span className="spinner" /> Analyse...</> : "↻ Analyser"}
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: "5px 14px" }}
                      onClick={() => sendEmailForClient(client.id)}
                      disabled={!r || !hasSmtp || emailLoading[client.id]}
                      title={!hasSmtp ? "Configurez le SMTP dans Paramètres" : !r ? "Lancez d'abord une analyse" : ""}
                    >
                      {emailLoading[client.id] ? <><span className="spinner" /> Envoi...</> : "Envoyer"}
                    </button>
                  </div>
                </div>

                {hasIssues && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    {r.issues.map((issue, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--danger)", padding: "2px 0" }}>
                        ▸ {issue}
                      </div>
                    ))}
                  </div>
                )}

                {er && (
                  <div style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: er.ok ? "rgba(0,212,168,0.08)" : "rgba(239,68,68,0.08)",
                    border: `1px solid ${er.ok ? "rgba(0,212,168,0.2)" : "rgba(239,68,68,0.2)"}`,
                    fontSize: 12,
                    color: er.ok ? "var(--ok)" : "var(--danger)",
                  }}>
                    {er.ok ? "✓" : "✗"} {er.message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
