import { useState } from "react";

export default function PerformancePanel({
  clients,
  perfResults,
  perfLoading,
  onCheckPerf,
  onCheckAllPerf,
}) {
  const allLoading = Object.values(perfLoading).some((l) => l);
  const hasResults = Object.keys(perfResults).length > 0;

  const checkedCount = Object.keys(perfResults).length;

  const avgMobile =
    checkedCount > 0
      ? Math.round(
          Object.values(perfResults).reduce(
            (sum, r) => sum + (r.mobile?.performance ?? r.mobile_score ?? 0),
            0
          ) / checkedCount
        )
      : 0;

  const avgDesktop =
    checkedCount > 0
      ? Math.round(
          Object.values(perfResults).reduce(
            (sum, r) =>
              sum + (r.desktop?.performance ?? r.desktop_score ?? 0),
            0
          ) / checkedCount
        )
      : 0;

  const issueCount = Object.values(perfResults).filter(
    (r) => r.issues && r.issues.length > 0
  ).length;

  return (
    <div>
      {hasResults && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <StatCard label="SITES TESTES" value={checkedCount} />
          <StatCard
            label="SCORE MOBILE MOY."
            value={`${avgMobile}/100`}
            color={scoreColor(avgMobile)}
          />
          <StatCard
            label="SCORE DESKTOP MOY."
            value={`${avgDesktop}/100`}
            color={scoreColor(avgDesktop)}
          />
          <StatCard
            label="AVEC ALERTES"
            value={issueCount}
            color={issueCount > 0 ? "var(--danger)" : "var(--text3)"}
          />
        </div>
      )}

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
          PERFORMANCE (PAGESPEED) ({clients.length})
        </h2>
        <button
          className="btn btn-secondary"
          onClick={onCheckAllPerf}
          disabled={allLoading || clients.length === 0}
        >
          {allLoading && <span className="spinner" />}
          &#8635; Tout tester
        </button>
      </div>

      {clients.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: "center", padding: 60, color: "var(--text3)" }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#9670;</div>
          <p style={{ fontSize: 14 }}>
            Aucun client. Ajoutez un site depuis l'onglet Monitoring.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {clients.map((client) => (
            <PerfResultCard
              key={client.id}
              client={client}
              result={perfResults[client.id]}
              isLoading={perfLoading[client.id]}
              onCheck={() => onCheckPerf(client)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PerfResultCard({ client, result, isLoading, onCheck }) {
  const [expanded, setExpanded] = useState(false);

  const hasResult = !!result;
  const hasIssues = result?.issues?.length > 0;

  const mobileScore = result?.mobile?.performance ?? result?.mobile_score ?? 0;
  const desktopScore =
    result?.desktop?.performance ?? result?.desktop_score ?? 0;
  const avgScore = hasResult ? Math.round((mobileScore + desktopScore) / 2) : 0;

  let globalStatus = "idle";
  if (isLoading) globalStatus = "loading";
  else if (hasResult) {
    if (avgScore >= 80) globalStatus = "ok";
    else if (avgScore >= 50) globalStatus = "warn";
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
    idle: "Non teste",
    loading: "Analyse en cours...",
    ok: "Performant",
    warn: "A ameliorer",
    error: "Lent",
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
              {client.url}
            </span>
          </div>
        </div>

        {hasResult && (
          <div style={{ display: "flex", gap: 8 }}>
            <ScoreBadge label="M" score={mobileScore} />
            <ScoreBadge label="D" score={desktopScore} />
          </div>
        )}

        <span
          style={{
            color: statusColors[globalStatus],
            fontSize: 12,
            fontWeight: 500,
            minWidth: 140,
            textAlign: "right",
          }}
        >
          {isLoading && (
            <span className="spinner" style={{ marginRight: 6 }} />
          )}
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
            &#8635; Tester
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
            ANALYSE PAGESPEED EN COURS
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text3)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              className="spinner"
              style={{ width: 10, height: 10, borderWidth: 1.5 }}
            />
            L'analyse peut prendre 20 a 40 secondes...
          </div>
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

      {expanded && hasResult && <PerfDetails result={result} />}
    </div>
  );
}

function PerfDetails({ result }) {
  const mobile = result.mobile || result.mobile_details;
  const desktop = result.desktop || result.desktop_details;

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
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <MetricsBlock title="MOBILE" data={mobile} />
        <MetricsBlock title="DESKTOP" data={desktop} />
      </div>

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

function MetricsBlock({ title, data }) {
  if (!data || (!data.performance && data.performance !== 0)) {
    return (
      <div
        style={{
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
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div style={{ color: "var(--text3)", fontSize: 12 }}>
          Aucune donnee
        </div>
      </div>
    );
  }

  const score = data.performance;
  const metrics = [
    { label: "FCP", value: data.fcp, desc: "First Contentful Paint" },
    { label: "LCP", value: data.lcp, desc: "Largest Contentful Paint" },
    { label: "TBT", value: data.tbt, desc: "Total Blocking Time" },
    { label: "CLS", value: data.cls, desc: "Cumulative Layout Shift" },
    { label: "SI", value: data.si, desc: "Speed Index" },
  ];

  return (
    <div
      style={{
        padding: 16,
        background: "var(--bg3)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "var(--text3)",
            fontFamily: "var(--mono)",
            letterSpacing: "0.08em",
          }}
        >
          {title}
        </div>
        <ScoreCircle score={score} />
      </div>

      {metrics.map((m) => (
        <div
          key={m.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--mono)",
                color: "var(--text2)",
                marginRight: 8,
              }}
            >
              {m.label}
            </span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              {m.desc}
            </span>
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--mono)",
              color: "var(--text)",
            }}
          >
            {m.value || "-"}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScoreCircle({ score }) {
  const color = scoreColor(score);
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ position: "relative", width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="var(--border)"
          strokeWidth="3"
        />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "var(--mono)",
          color,
        }}
      >
        {score}
      </div>
    </div>
  );
}

function ScoreBadge({ label, score }) {
  let cls = "badge-error";
  if (score >= 80) cls = "badge-ok";
  else if (score >= 50) cls = "badge-warn";

  return (
    <span
      className={`badge ${cls}`}
      style={{ fontSize: 11, padding: "3px 8px" }}
    >
      {label}: {score}
    </span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        padding: 16,
        background: "var(--bg2)",
        borderRadius: 8,
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text3)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          fontFamily: "var(--mono)",
          color: color || "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function scoreColor(score) {
  if (score >= 80) return "var(--ok)";
  if (score >= 50) return "var(--warn)";
  return "var(--danger)";
}
