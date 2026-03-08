export default function ReportView({ clients, results }) {
  const hasData = Object.keys(results).length > 0;

  const stats = {
    total: clients.length,
    checked: Object.keys(results).length,
    ok: Object.values(results).filter((r) => !r.issues || r.issues.length === 0).length,
    warnings: Object.values(results).filter((r) => r.issues && r.issues.length === 1).length,
    errors: Object.values(results).filter((r) => r.issues && r.issues.length > 1).length,
    avgResponseTime: Object.values(results).filter((r) => r.http?.responseTime).reduce((sum, r) => sum + (r.http.responseTime || 0), 0) / (Object.values(results).filter((r) => r.http?.responseTime).length || 1),
    avgSecurityScore: Object.values(results).filter((r) => r.http?.securityScore !== undefined).reduce((sum, r) => sum + (r.http.securityScore || 0), 0) / (Object.values(results).filter((r) => r.http?.securityScore !== undefined).length || 1),
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

  const getEmailBadge = (dns) => {
    if (!dns) return null;
    const checks = [dns.mxOk, dns.spfOk, dns.dmarcOk, dns.dkimOk].filter(Boolean).length;
    const total = 4;
    if (checks === total) return { cls: "ok", label: `${checks}/${total}` };
    if (checks >= 2) return { cls: "warn", label: `${checks}/${total}` };
    return { cls: "error", label: `${checks}/${total}` };
  };

  const exportHTML = () => {
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport AJent - ${new Date().toLocaleDateString("fr-FR")}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 40px 20px; }
    .container { max-width: 1100px; margin: auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.08); }
    .header { border-bottom: 2px solid #00d4a8; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 32px; color: #0a0c0f; margin-bottom: 8px; }
    .header .date { color: #666; font-size: 14px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 40px; }
    .stat { background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .stat-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .stat-value { font-size: 28px; font-weight: 600; color: #0a0c0f; }
    .stat.ok .stat-value { color: #10b981; }
    .stat.warn .stat-value { color: #f59e0b; }
    .stat.error .stat-value { color: #ef4444; }
    .section-title { font-size: 18px; font-weight: 600; margin: 40px 0 20px; color: #0a0c0f; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
    thead { background: #f9fafb; }
    th { text-align: left; padding: 12px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge.ok { background: #d1fae5; color: #065f46; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.error { background: #fee2e2; color: #991b1b; }
    .badge.idle { background: #f3f4f6; color: #6b7280; }
    .issue-list { list-style: none; margin-top: 8px; }
    .issue-list li { color: #ef4444; font-size: 13px; padding: 4px 0; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px; }
    @media print { body { background: white; padding: 0; } .container { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AJent -- Rapport de Monitoring</h1>
      <div class="date">Genere le ${new Date().toLocaleString("fr-FR")}</div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-label">Total Sites</div>
        <div class="stat-value">${stats.total}</div>
      </div>
      <div class="stat ok">
        <div class="stat-label">Operationnels</div>
        <div class="stat-value">${stats.ok}</div>
      </div>
      <div class="stat warn">
        <div class="stat-label">Avertissements</div>
        <div class="stat-value">${stats.warnings}</div>
      </div>
      <div class="stat error">
        <div class="stat-label">Erreurs</div>
        <div class="stat-value">${stats.errors}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Temps Reponse Moy.</div>
        <div class="stat-value">${Math.round(stats.avgResponseTime)}ms</div>
      </div>
      <div class="stat">
        <div class="stat-label">Securite Moy.</div>
        <div class="stat-value">${Math.round(stats.avgSecurityScore)}/100</div>
      </div>
    </div>

    <h2 class="section-title">Details des Sites</h2>
    <table>
      <thead>
        <tr>
          <th>Site</th>
          <th>Status</th>
          <th>HTTP</th>
          <th>SSL</th>
          <th>DNS</th>
          <th>Securite</th>
          <th>Email</th>
          <th>Temps</th>
          <th>Verifie</th>
        </tr>
      </thead>
      <tbody>
        ${clients.map((client) => {
          const result = results[client.id];
          if (!result) {
            return `
              <tr>
                <td><strong>${client.name}</strong><br><small style="color:#666">${client.url}</small></td>
                <td><span class="badge idle">Non verifie</span></td>
                <td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>
              </tr>
            `;
          }
          const hasIssues = result.issues && result.issues.length > 0;
          const status = hasIssues ? (result.issues.length > 1 ? "error" : "warn") : "ok";
          const statusLabel = hasIssues ? (result.issues.length > 1 ? "Erreur" : "Attention") : "OK";
          const httpB = getHttpBadge(result.http);
          const sslB = getSslBadge(result.ssl);
          const dnsB = getDnsBadge(result.dns);
          const secB = getSecurityBadge(result.http);
          const emlB = getEmailBadge(result.dns);
          return `
            <tr>
              <td><strong>${client.name}</strong><br><small style="color:#666">${client.url}</small></td>
              <td><span class="badge ${status}">${statusLabel}</span></td>
              <td><span class="badge ${httpB.cls}">${httpB.label}</span></td>
              <td><span class="badge ${sslB.cls}">${sslB.label}</span></td>
              <td><span class="badge ${dnsB.cls}">${dnsB.label}</span></td>
              <td>${secB ? `<span class="badge ${secB.cls}">${secB.label}</span>` : "-"}</td>
              <td>${emlB ? `<span class="badge ${emlB.cls}">${emlB.label}</span>` : "-"}</td>
              <td>${result.http?.responseTime || "-"}ms</td>
              <td>${new Date(result.checkedAt).toLocaleTimeString("fr-FR")}</td>
            </tr>
            ${hasIssues ? `
              <tr>
                <td colspan="9">
                  <ul class="issue-list">
                    ${result.issues.map((issue) => `<li>! ${issue}</li>`).join("")}
                  </ul>
                </td>
              </tr>
            ` : ""}
          `;
        }).join("")}
      </tbody>
    </table>

    <div class="footer">
      Rapport genere par AJent Monitoring Dashboard
    </div>
  </div>
</body>
</html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ajent-rapport-${new Date().toISOString().split("T")[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--mono)",
            fontSize: 14,
            letterSpacing: "0.08em",
            color: "var(--text2)",
            flex: 1,
          }}
        >
          RAPPORT DE MONITORING
        </h2>
        <button className="btn btn-secondary" onClick={printReport} disabled={!hasData}>
          Imprimer
        </button>
        <button className="btn btn-primary" onClick={exportHTML} disabled={!hasData}>
          Exporter HTML
        </button>
      </div>

      {!hasData ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--text3)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16, color: "var(--accent)" }}>&#9670;</div>
          <p style={{ fontSize: 14 }}>
            Aucune donnee disponible. Effectuez au moins une verification depuis l'onglet Monitoring.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 16,
              marginBottom: 32,
            }}
          >
            <div className="card">
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 8 }}>
                TOTAL SITES
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--mono)" }}>
                {stats.total}
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 8 }}>
                OPERATIONNELS
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--mono)", color: "var(--ok)" }}>
                {stats.ok}
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 8 }}>
                AVERTISSEMENTS
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--mono)", color: "var(--warn)" }}>
                {stats.warnings}
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 8 }}>
                ERREURS
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--mono)", color: stats.errors > 0 ? "var(--danger)" : "var(--text3)" }}>
                {stats.errors}
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 8 }}>
                TEMPS REPONSE MOY.
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--mono)" }}>
                {Math.round(stats.avgResponseTime)}ms
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 8 }}>
                SECURITE MOY.
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--mono)", color: stats.avgSecurityScore >= 60 ? "var(--ok)" : stats.avgSecurityScore >= 40 ? "var(--warn)" : "var(--danger)" }}>
                {Math.round(stats.avgSecurityScore)}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 20, fontSize: 14, fontWeight: 600 }}>
              Details des Sites
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  fontFamily: "var(--mono)",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border2)" }}>
                    {["SITE", "STATUS", "HTTP", "SSL", "DNS", "SECURITE", "EMAIL", "TEMPS", "VERIFIE"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: 12, color: "var(--text3)", fontSize: 11, letterSpacing: "0.08em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const result = results[client.id];
                    if (!result) {
                      return (
                        <tr key={client.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: 12 }}>
                            <div style={{ fontWeight: 600 }}>{client.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text3)" }}>{client.url}</div>
                          </td>
                          <td colSpan={8} style={{ padding: 12, color: "var(--text3)" }}>
                            Non verifie
                          </td>
                        </tr>
                      );
                    }
                    const hasIssues = result.issues && result.issues.length > 0;
                    const status = hasIssues ? (result.issues.length > 1 ? "error" : "warn") : "ok";
                    const httpB = getHttpBadge(result.http);
                    const sslB = getSslBadge(result.ssl);
                    const dnsB = getDnsBadge(result.dns);
                    const secB = getSecurityBadge(result.http);
                    const emlB = getEmailBadge(result.dns);

                    return (
                      <tr key={client.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: 600 }}>{client.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text3)" }}>{client.url}</div>
                        </td>
                        <td style={{ padding: 12 }}>
                          <span className={`badge badge-${status}`}>
                            {hasIssues ? (result.issues.length > 1 ? "ERREUR" : "ATTENTION") : "OK"}
                          </span>
                        </td>
                        <td style={{ padding: 12 }}>
                          <span className={`badge badge-${httpB.cls}`}>{httpB.label}</span>
                        </td>
                        <td style={{ padding: 12 }}>
                          <span className={`badge badge-${sslB.cls}`}>{sslB.label}</span>
                        </td>
                        <td style={{ padding: 12 }}>
                          <span className={`badge badge-${dnsB.cls}`}>{dnsB.label}</span>
                        </td>
                        <td style={{ padding: 12 }}>
                          {secB ? <span className={`badge badge-${secB.cls}`}>{secB.label}</span> : "-"}
                        </td>
                        <td style={{ padding: 12 }}>
                          {emlB ? <span className={`badge badge-${emlB.cls}`}>{emlB.label}</span> : "-"}
                        </td>
                        <td style={{ padding: 12, color: "var(--text2)" }}>
                          {result.http?.responseTime || "-"}ms
                        </td>
                        <td style={{ padding: 12, color: "var(--text2)", fontSize: 11 }}>
                          {new Date(result.checkedAt).toLocaleTimeString("fr-FR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
