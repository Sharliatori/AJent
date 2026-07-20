import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { CloudCog, Lock, Mail, Eye, EyeOff, CircleAlert as AlertCircle, ShieldAlert } from "lucide-react";

const ALLOWED_ADMIN_EMAIL = "nicolas.sinou@lutecia.ai";

export default function AdminAuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      if (data.user.email !== ALLOWED_ADMIN_EMAIL) {
        await supabase.auth.signOut();
        setError("Acces refuse. Ce compte n'a pas les droits administrateur.");
        setSession(null);
      }
    } catch (err) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0c0f" }}>
        <div className="spinner" style={{ width: "24px", height: "24px" }} />
      </div>
    );
  }

  if (!session || session.user.email !== ALLOWED_ADMIN_EMAIL) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0c0f", padding: "16px", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <CloudCog style={{ width: "28px", height: "28px", color: "#0EA5E9" }} />
              <span style={{ fontSize: "20px", fontWeight: "700", color: "#e8edf2", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em" }}>
                AJENT
              </span>
            </div>
            <p style={{ color: "#4a5a6a", fontSize: "13px" }}>
              Administration — Acces restreint
            </p>
          </div>

          <div style={{ background: "#10141a", borderRadius: "12px", border: "1px solid #1e2730", padding: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
              <ShieldAlert style={{ width: "18px", height: "18px", color: "#0EA5E9" }} />
              <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#e8edf2" }}>
                Connexion Admin
              </h2>
            </div>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", marginBottom: "16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "#ef4444", fontSize: "12px" }}>
                <AlertCircle style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "500", color: "#8494a6", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Email
                </label>
                <div style={{ position: "relative" }}>
                  <Mail style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", color: "#4a5a6a" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin@email.com"
                    style={{ width: "100%", paddingLeft: "34px", paddingRight: "12px", paddingTop: "9px", paddingBottom: "9px", background: "#161c24", border: "1px solid #2a3442", borderRadius: "7px", fontSize: "13px", color: "#e8edf2", outline: "none", fontFamily: "'DM Sans', sans-serif" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "500", color: "#8494a6", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Mot de passe
                </label>
                <div style={{ position: "relative" }}>
                  <Lock style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", color: "#4a5a6a" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{ width: "100%", paddingLeft: "34px", paddingRight: "36px", paddingTop: "9px", paddingBottom: "9px", background: "#161c24", border: "1px solid #2a3442", borderRadius: "7px", fontSize: "13px", color: "#e8edf2", outline: "none", fontFamily: "'DM Sans', sans-serif" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#4a5a6a", padding: "0" }}
                  >
                    {showPassword ? <EyeOff style={{ width: "14px", height: "14px" }} /> : <Eye style={{ width: "14px", height: "14px" }} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{ width: "100%", padding: "10px", background: submitting ? "#1e2730" : "#0EA5E9", color: submitting ? "#4a5a6a" : "#000", fontWeight: "600", fontSize: "13px", borderRadius: "7px", border: "none", cursor: submitting ? "not-allowed" : "pointer", marginTop: "6px", fontFamily: "'DM Sans', sans-serif" }}
              >
                {submitting ? "Connexion..." : "Se connecter"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
