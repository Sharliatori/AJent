import { useState } from "react";

export default function DnsResultCard({ client, result, isLoading, onCheck }) {
  const [expanded, setExpanded] = useState(false);

  const hasResult = !!result;
  const hasIssues = result?.issues?.length > 0;
  const score = result?.overallScore ?? 0;

  let globalStatus = "idle";
  if (isLoading) globalStatus = "loading";
  else if (hasResult) {
    if (score >= 80) globalStatus = "ok";
    else if (score >= 50) globalStatus = "warn";
    else globalStatus = "error";
  }

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
    ok: "Conforme",
    warn: "Partiellement conforme",
    error: "Non conforme",
  };

  return (
    <div
      className="card"
      style={{
        borderColor: hasIssues ? "rgba(239,68,68,0.2)" : "var(--border)",
        transition: "border-color 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: statusColors[globalStatus],
            flexShrink: 0,
            boxShadow:
              globalStatus === "ok"
                ? "0 0 6px var(--ok)"
                : globalStatus === "error"
                ? "0 0 6px var(--danger)"
                : "none",
          }}
          className={isLoading ? "pulse" : ""}
        />

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {client.name}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--text3)",
                fontFamily: "var(--mono)",
              }}
            >
              {client.domain}
            </span>
          </div>
        </div>

        {hasResult && (
          <ScoreBadge score={score} />
        )}

        <span
          style={{
            color: statusColors[globalStatus],
            fontSize: 12,
            fontWeight: 500,
            minWidth: 160,
            textAlign: "right",
          }}
        >
          {isLoading && <span className="spinner" style={{ marginRight: 6 }} />}
          {statusLabels[globalStatus]}
        </span>

        {result?.checkedAt && (
          <span
            style={{
              color: "var(--text3)",
              fontSize: 11,
              minWidth: 80,
              textAlign: "right",
            }}
          >
            {new Date(result.checkedAt).toLocaleTimeString("fr-FR")}
          </span>
        )}

        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          {hasResult && (
            <button
              className="btn btn-ghost"
              style={{ padding: "4px 10px", fontSize: 11 }}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "\u25B2" : "\u25BC"} Details
            </button>
          )}
          <button
            className="btn btn-secondary"
            style={{ padding: "4px 10px", fontSize: 11 }}
            onClick={onCheck}
            disabled={isLoading}
          >
            &#8635; Verifier
          </button>
        </div>
      </div>

      {isLoading && !hasResult && (
        <div
          style={{
            marginTop: 12,
            padding: 16,
            background: "var(--bg3)",
            borderRadius: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text3)",
              fontFamily: "var(--mono)",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            VERIFICATION DNS & EMAIL EN COURS
          </div>
          {["DNS A/AAAA", "Serveurs NS", "Enregistrements MX", "SPF", "DMARC", "DKIM"].map(
            (step) => (
              <div
                key={step}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 0",
                  fontSize: 12,
                  color: "var(--text3)",
                }}
              >
                <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                {step}...
              </div>
            )
          )}
        </div>
      )}

      {hasIssues && !expanded && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            background: "rgba(239,68,68,0.06)",
            borderRadius: 6,
            border: "1px solid rgba(239,68,68,0.15)",
          }}
        >
          {result.issues.slice(0, 3).map((issue, i) => (
            <div
              key={i}
              style={{
                color: "var(--danger)",
                fontSize: 12,
                fontFamily: "var(--mono)",
                lineHeight: 1.7,
              }}
            >
              ! {issue}
            </div>
          ))}
          {result.issues.length > 3 && (
            <div
              style={{
                color: "var(--text3)",
                fontSize: 11,
                fontFamily: "var(--mono)",
                marginTop: 4,
              }}
            >
              +{result.issues.length - 3} alerte(s) supplementaire(s)
            </div>
          )}
        </div>
      )}

      {expanded && result && <DnsDetails result={result} />}
    </div>
  );
}

function ScoreBadge({ score }) {
  let cls = "badge-error";
  if (score >= 80) cls = "badge-ok";
  else if (score >= 50) cls = "badge-warn";

  return (
    <span className={`badge ${cls}`} style={{ fontSize: 12, padding: "4px 10px" }}>
      {score}/100
    </span>
  );
}

function CheckRow({ label, ok, detail, record, warnings }) {
  const status = ok === true ? "ok" : ok === false ? "error" : "idle";
  const dot = { ok: "\u25CF", error: "\u25CF", idle: "\u25CB" }[status];

  return (
    <div
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 80,
            color: "var(--text2)",
            fontSize: 12,
            fontFamily: "var(--mono)",
            flexShrink: 0,
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        <span className={`badge badge-${status}`}>
          {dot} {status === "ok" ? "OK" : status === "error" ? "ABSENT" : "N/A"}
        </span>
        <span
          style={{
            color: "var(--text2)",
            fontSize: 12,
            fontFamily: "var(--mono)",
            flex: 1,
          }}
        >
          {detail}
        </span>
      </div>

      {record && (
        <div
          style={{
            marginTop: 6,
            marginLeft: 90,
            padding: "6px 10px",
            background: "var(--bg3)",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "var(--mono)",
            color: "var(--text2)",
            wordBreak: "break-all",
            lineHeight: 1.6,
          }}
        >
          {record}
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div style={{ marginTop: 6, marginLeft: 90 }}>
          {warnings.map((w, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                color: "var(--warn)",
                fontFamily: "var(--mono)",
                lineHeight: 1.6,
              }}
            >
              &#9888; {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DnsDetails({ result }) {
  const { dns_a, dns_aaaa, dns_ns, dns_mx, dns_spf, dns_dmarc, dns_dkim } = result;

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text3)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.08em",
          marginBottom: 12,
        }}
      >
        DETAILS DNS
      </div>

      <CheckRow
        label="A"
        ok={dns_a?.ok}
        detail={
          dns_a?.ok
            ? `${dns_a.records.length} enregistrement(s): ${dns_a.records.join(", ")}${dns_a.ttl ? ` (TTL: ${dns_a.ttl}s)` : ""}`
            : dns_a?.error || "Non resolu"
        }
      />

      <CheckRow
        label="AAAA"
        ok={dns_aaaa?.ok}
        detail={
          dns_aaaa?.ok
            ? `${dns_aaaa.records.length} enregistrement(s) IPv6`
            : "Pas d'IPv6"
        }
      />

      <CheckRow
        label="NS"
        ok={dns_ns?.ok}
        detail={
          dns_ns?.ok
            ? dns_ns.records.join(", ")
            : dns_ns?.error || "Non disponible"
        }
      />

      <div
        style={{
          fontSize: 11,
          color: "var(--text3)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.08em",
          marginTop: 20,
          marginBottom: 12,
        }}
      >
        AUTHENTIFICATION EMAIL
      </div>

      <CheckRow
        label="MX"
        ok={dns_mx?.ok}
        detail={
          dns_mx?.ok
            ? dns_mx.records
                .map((r) => `${r.exchange} (pri: ${r.priority})`)
                .join(", ")
            : dns_mx?.error || "Non configure"
        }
      />

      <CheckRow
        label="SPF"
        ok={dns_spf?.ok}
        detail={
          dns_spf?.ok
            ? `Politique: ${dns_spf.policy || "definie"}`
            : dns_spf?.error || "Absent"
        }
        record={dns_spf?.record}
        warnings={dns_spf?.warnings}
      />

      <CheckRow
        label="DMARC"
        ok={dns_dmarc?.ok}
        detail={
          dns_dmarc?.ok
            ? `Politique: ${dns_dmarc.policy || "definie"}${dns_dmarc.reportEmail ? ` | Rapports: ${dns_dmarc.reportEmail}` : ""}`
            : dns_dmarc?.error || "Absent"
        }
        record={dns_dmarc?.record}
        warnings={dns_dmarc?.warnings}
      />

      <CheckRow
        label="DKIM"
        ok={dns_dkim?.ok}
        detail={
          dns_dkim?.ok
            ? `Selecteur(s) trouve(s): ${dns_dkim.foundSelectors.join(", ")}`
            : dns_dkim?.error || "Non detecte"
        }
      />

      {result.issues && result.issues.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            background: "rgba(239,68,68,0.06)",
            borderRadius: 6,
            border: "1px solid rgba(239,68,68,0.15)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text3)",
              fontFamily: "var(--mono)",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            ALERTES ({result.issues.length})
          </div>
          {result.issues.map((issue, i) => (
            <div
              key={i}
              style={{
                color: "var(--danger)",
                fontSize: 12,
                fontFamily: "var(--mono)",
                lineHeight: 1.7,
              }}
            >
              ! {issue}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
