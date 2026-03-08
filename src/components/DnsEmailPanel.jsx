import { useState } from "react";
import DnsResultCard from "./DnsResultCard";

export default function DnsEmailPanel({ clients, dnsResults, dnsLoading, onCheckDns, onCheckAllDns }) {
  const allLoading = Object.values(dnsLoading).some((l) => l);
  const hasResults = Object.keys(dnsResults).length > 0;

  const checkedCount = Object.keys(dnsResults).length;
  const avgScore = checkedCount > 0
    ? Math.round(
        Object.values(dnsResults).reduce((sum, r) => sum + (r.overallScore || 0), 0) / checkedCount
      )
    : 0;

  const fullPassCount = Object.values(dnsResults).filter(
    (r) => !r.issues || r.issues.length === 0
  ).length;
  const issueCount = Object.values(dnsResults).filter(
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
          <StatCard label="DOMAINES VERIFIES" value={checkedCount} />
          <StatCard label="SCORE MOYEN" value={`${avgScore}/100`} color={scoreColor(avgScore)} />
          <StatCard label="CONFORMES" value={fullPassCount} color="var(--ok)" />
          <StatCard label="AVEC ALERTES" value={issueCount} color={issueCount > 0 ? "var(--danger)" : "var(--text3)"} />
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
          VERIFICATION DNS & EMAIL ({clients.length})
        </h2>
        <button
          className="btn btn-secondary"
          onClick={onCheckAllDns}
          disabled={allLoading || clients.length === 0}
        >
          {allLoading && <span className="spinner" />}
          &#8635; Tout verifier
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
            <DnsResultCard
              key={client.id}
              client={client}
              result={dnsResults[client.id]}
              isLoading={dnsLoading[client.id]}
              onCheck={() => onCheckDns(client)}
            />
          ))}
        </div>
      )}
    </div>
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
