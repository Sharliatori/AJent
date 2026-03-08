import { useState } from "react";
import LiveCheckPanel from "./LiveCheckPanel";
import { monitoringService } from "../lib/supabase";

function DetailRow({ label, ok, detail, children }) {
  const status = ok === true ? "ok" : ok === false ? "error" : "idle";
  const dot = { ok: "●", error: "●", idle: "○" }[status];

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "6px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ width: 100, color: "var(--text2)", fontSize: 12, fontFamily: "var(--mono)", flexShrink: 0 }}>
        {label}
      </span>
      <span className={`badge badge-${status}`}>{dot} {status.toUpperCase()}</span>
      <span style={{ color: "var(--text2)", fontSize: 12, fontFamily: "var(--mono)", flex: 1 }}>
        {detail}
      </span>
      {children}
    </div>
  );
}

function SecurityBar({ score }) {
  if (score === undefined || score === null) return null;
  const color = score >= 80 ? "var(--ok)" : score >= 40 ? "var(--warn)" : "var(--danger)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 80,
        height: 6,
        background: "var(--bg3)",
        borderRadius: 3,
        overflow: "hidden",
      }}>
        <div style={{
          width: `${score}%`,
          height: "100%",
          background: color,
          borderRadius: 3,
          transition: "width 0.3s ease",
        }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: "var(--mono)", color }}>{score}/100</span>
    </div>
  );
}

export default function ClientCard({ client, result, isLoading, onCheck, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    if (!showHistory) {
      try {
        const data = await monitoringService.getHistory(client.id, 20);
        setHistory(data);
      } catch (err) {
        console.error("Failed to load history:", err);
      }
    }
    setShowHistory(!showHistory);
  };

  const hasResult = !!result;
  const hasIssues = result?.issues?.length > 0;

  let globalStatus = "idle";
  if (isLoading) globalStatus = "loading";
  else if (hasResult) globalStatus = hasIssues ? (result.issues.length >= 2 ? "error" : "warn") : "ok";

  const statusColors = {
    idle: "var(--text3)",
    loading: "var(--accent)",
    ok: "var(--ok)",
    warn: "var(--warn)",
    error: "var(--danger)",
  };

  const statusLabels = {
    idle: "Non verifie",
    loading: "Verification...",
    ok: "Operationnel",
    warn: "Attention",
    error: "Probleme detecte",
  };

  const httpOk = result?.http?.ok ?? result?.http?.success;
  const sslOk = result?.ssl?.ok ?? result?.ssl?.success;
  const dnsOk = result?.dns?.ok ?? result?.dns?.success;

  return (
    <div
      className="card"
      style={{
        borderColor: hasIssues ? "rgba(239,68,68,0.2)" : "var(--border)",
        transition: "border-color 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%",
          background: statusColors[globalStatus],
          flexShrink: 0,
          boxShadow: globalStatus === "ok" ? `0 0 6px var(--ok)` :
                     globalStatus === "error" ? `0 0 6px var(--danger)` : "none",
        }} className={isLoading ? "pulse" : ""} />

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{client.name}</span>
            {client.tags?.map((t) => (
              <span key={t} style={{
                fontSize: 10, padding: "1px 6px", borderRadius: 3,
                background: "var(--bg3)", color: "var(--text3)",
                fontFamily: "var(--mono)", letterSpacing: "0.04em",
              }}>{t}</span>
            ))}
          </div>
          <a
            href={client.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text3)", fontSize: 12, fontFamily: "var(--mono)", textDecoration: "none" }}
          >
            {client.url}
          </a>
        </div>

        <span style={{ color: statusColors[globalStatus], fontSize: 12, fontWeight: 500, minWidth: 130, textAlign: "right" }}>
          {isLoading ? <><span className="spinner" style={{ marginRight: 6 }} /></> : null}
          {statusLabels[globalStatus]}
        </span>

        {result?.http?.responseTime && (
          <span style={{
            fontFamily: "var(--mono)", fontSize: 12, color: "var(--text3)",
            minWidth: 60, textAlign: "right",
          }}>
            {result.http.responseTime}ms
          </span>
        )}

        {result?.checkedAt && (
          <span style={{ color: "var(--text3)", fontSize: 11, minWidth: 80, textAlign: "right" }}>
            {new Date(result.checkedAt).toLocaleTimeString("fr-FR")}
          </span>
        )}

        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          {hasResult && (
            <>
              <button
                className="btn btn-ghost"
                style={{ padding: "4px 10px", fontSize: 11 }}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "▲" : "▼"} Details
              </button>
              <button
                className="btn btn-ghost"
                style={{ padding: "4px 10px", fontSize: 11 }}
                onClick={loadHistory}
              >
                {showHistory ? "▲" : "▼"} Historique
              </button>
            </>
          )}
          <button
            className="btn btn-secondary"
            style={{ padding: "4px 10px", fontSize: 11 }}
            onClick={onCheck}
            disabled={isLoading}
          >
            &#8635; Verifier
          </button>
          <button
            className="btn btn-danger"
            style={{ padding: "4px 8px", fontSize: 11 }}
            onClick={onRemove}
          >
            &#10005;
          </button>
        </div>
      </div>

      {isLoading && <LiveCheckPanel result={result} loading={isLoading} />}

      {hasIssues && !expanded && (
        <div style={{
          marginTop: 12, padding: "8px 12px",
          background: "rgba(239,68,68,0.06)",
          borderRadius: 6, border: "1px solid rgba(239,68,68,0.15)",
        }}>
          {result.issues.map((issue, i) => (
            <div key={i} style={{ color: "var(--danger)", fontSize: 12, fontFamily: "var(--mono)", lineHeight: 1.7 }}>
              ! {issue}
            </div>
          ))}
        </div>
      )}

      {expanded && result && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          {result.ping && (
            <DetailRow
              label="PING"
              ok={result.ping.ok ?? result.ping.success}
              detail={result.ping.ok || result.ping.success
                ? `${result.ping.latency}ms`
                : result.ping.error || "Echec"}
            />
          )}

          {result.http && (
            <DetailRow
              label="HTTP"
              ok={httpOk}
              detail={httpOk
                ? `HTTP ${result.http.statusCode ?? result.http.status} | ${result.http.responseTime}ms | TTFB ${result.http.ttfb || "-"}ms | ${((result.http.contentLength || 0) / 1024).toFixed(1)}KB`
                : result.http.error || "Echec"}
            />
          )}

          {result.ssl && (
            <DetailRow
              label="SSL/TLS"
              ok={sslOk}
              detail={sslOk
                ? `${result.ssl.protocol || "HTTPS"} | ${result.ssl.daysLeft ? result.ssl.daysLeft + "j restants" : "Valide"} ${result.ssl.issuer ? "| " + result.ssl.issuer : ""}`
                : result.ssl.error || "Invalide"}
            />
          )}

          {result.dns && (
            <DetailRow
              label="DNS"
              ok={dnsOk}
              detail={dnsOk
                ? `${result.dns.aRecords?.length || 0} enregistrement(s) A ${result.dns.aRecords?.[0] ? "| " + result.dns.aRecords[0] : ""}`
                : result.dns.error || "Non resolu"}
            />
          )}

          {result.http?.securityScore !== undefined && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 0",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ width: 100, color: "var(--text2)", fontSize: 12, fontFamily: "var(--mono)", flexShrink: 0 }}>
                SECURITE
              </span>
              <SecurityBar score={result.http.securityScore} />
              <span style={{ color: "var(--text3)", fontSize: 11, fontFamily: "var(--mono)" }}>
                {[
                  result.http.headers?.hsts && "HSTS",
                  result.http.headers?.xframe && "X-Frame",
                  result.http.headers?.csp && "CSP",
                  result.http.headers?.xContentType && "X-Content-Type",
                  result.http.headers?.referrerPolicy && "Referrer-Policy",
                ].filter(Boolean).join(" | ") || "Aucun header de securite"}
              </span>
            </div>
          )}

          {hasIssues && (
            <div style={{
              marginTop: 12, padding: "8px 12px",
              background: "rgba(239,68,68,0.06)",
              borderRadius: 6, border: "1px solid rgba(239,68,68,0.15)",
            }}>
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 6 }}>
                ALERTES ({result.issues.length})
              </div>
              {result.issues.map((issue, i) => (
                <div key={i} style={{ color: "var(--danger)", fontSize: 12, fontFamily: "var(--mono)", lineHeight: 1.7 }}>
                  ! {issue}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showHistory && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div style={{
            fontSize: 11,
            color: "var(--text3)",
            fontFamily: "var(--mono)",
            letterSpacing: "0.08em",
            marginBottom: 12
          }}>
            HISTORIQUE DES VERIFICATIONS
          </div>

          {history.length === 0 ? (
            <div style={{ color: "var(--text3)", fontSize: 12, padding: "12px 0" }}>
              Aucun historique disponible
            </div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, fontFamily: "var(--mono)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text3)", fontWeight: 500 }}>Date</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text3)", fontWeight: 500 }}>HTTP</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text3)", fontWeight: 500 }}>Temps</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text3)", fontWeight: 500 }}>Alertes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, idx) => {
                    const httpStatus = item.http_status?.statusCode ?? item.http_status?.status;
                    const httpIsOk = item.http_status?.ok ?? item.http_status?.success;
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 8px", color: "var(--text2)" }}>
                          {new Date(item.checked_at).toLocaleString("fr-FR")}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <span className={`badge badge-${httpIsOk ? "ok" : "error"}`}>
                            {httpStatus || "N/A"}
                          </span>
                        </td>
                        <td style={{ padding: "6px 8px", color: "var(--text2)" }}>
                          {item.http_status?.responseTime ? `${item.http_status.responseTime}ms` : "-"}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <span style={{
                            color: item.issues?.length > 0 ? "var(--danger)" : "var(--ok)",
                            fontWeight: 500
                          }}>
                            {item.issues?.length || 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
