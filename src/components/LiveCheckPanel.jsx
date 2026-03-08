import { Activity, Zap, Globe, Shield } from "lucide-react";

export default function LiveCheckPanel({ result, loading }) {
  if (!loading && !result) return null;

  const steps = [
    {
      id: "ping",
      icon: Zap,
      label: "Ping / Latence",
      data: result?.ping,
      loading: loading && !result?.ping,
    },
    {
      id: "dns",
      icon: Globe,
      label: "DNS Lookup",
      data: result?.dns,
      loading: loading && !result?.dns,
    },
    {
      id: "ssl",
      icon: Shield,
      label: "SSL/TLS",
      data: result?.ssl,
      loading: loading && !result?.ssl,
    },
    {
      id: "http",
      icon: Activity,
      label: "HTTP Request",
      data: result?.http,
      loading: loading && !result?.http,
    },
  ];

  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 16,
        marginTop: 12,
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
        VÉRIFICATION EN COURS
      </div>

      {steps.map((step) => {
        const Icon = step.icon;
        const isLoading = step.loading;
        const hasData = step.data !== undefined;
        const isSuccess = hasData && step.data.success !== false;
        const isError = hasData && step.data.success === false;

        return (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "8px 0",
              borderBottom:
                step.id !== "http" ? "1px solid var(--border)" : "none",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                background: isError
                  ? "rgba(244, 63, 94, 0.1)"
                  : isSuccess
                  ? "rgba(34, 197, 94, 0.1)"
                  : "var(--bg3)",
                color: isError
                  ? "var(--danger)"
                  : isSuccess
                  ? "var(--ok)"
                  : "var(--text3)",
              }}
            >
              <Icon size={14} />
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text1)",
                  marginBottom: 4,
                }}
              >
                {step.label}
              </div>

              {isLoading && (
                <div style={{ fontSize: 12, color: "var(--text3)" }}>
                  Vérification en cours...
                </div>
              )}

              {isSuccess && step.id === "ping" && (
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  Latence: {step.data.latency}ms
                </div>
              )}

              {isSuccess && step.id === "dns" && (
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  {step.data.records?.length || 0} enregistrement(s) DNS
                  {step.data.records?.length > 0 && (
                    <div
                      style={{
                        marginTop: 4,
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        color: "var(--text3)",
                      }}
                    >
                      {step.data.records.slice(0, 2).join(", ")}
                    </div>
                  )}
                </div>
              )}

              {isSuccess && step.id === "ssl" && (
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  Certificat SSL valide
                </div>
              )}

              {isSuccess && step.id === "http" && (
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  HTTP {step.data.status} • {step.data.responseTime}ms
                  {step.data.contentLength > 0 && (
                    <span style={{ color: "var(--text3)", marginLeft: 8 }}>
                      • {(step.data.contentLength / 1024).toFixed(1)}KB
                    </span>
                  )}
                </div>
              )}

              {isError && (
                <div style={{ fontSize: 12, color: "var(--danger)" }}>
                  {step.data.error || "Échec de la vérification"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
