import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { CloudCog, Mail, Lock, User, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, displayName);
      }
      navigate("/portal/dashboard");
    } catch (err) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <CloudCog style={{ width: "32px", height: "32px", color: "#0d9488" }} />
            <span style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>
              Lutec<span style={{ color: "#0d9488" }}>.IA</span>
            </span>
          </div>
          <p style={{ color: "#64748b", fontSize: "14px" }}>
            Espace client — Suivi de votre site
          </p>
        </div>

        <div style={{ background: "#ffffff", borderRadius: "16px", boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0", padding: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#0f172a", marginBottom: "24px", textAlign: "center" }}>
            {mode === "login" ? "Connexion" : "Creer un compte"}
          </h2>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", marginBottom: "16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#b91c1c", fontSize: "13px" }}>
              <AlertCircle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {mode === "signup" && (
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "6px" }}>
                  Nom
                </label>
                <div style={{ position: "relative" }}>
                  <User style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#9ca3af" }} />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Votre nom"
                    style={{ width: "100%", paddingLeft: "40px", paddingRight: "16px", paddingTop: "10px", paddingBottom: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", color: "#0f172a", outline: "none" }}
                    onFocus={(e) => e.target.style.borderColor = "#0d9488"}
                    onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "6px" }}>
                Email
              </label>
              <div style={{ position: "relative" }}>
                <Mail style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#9ca3af" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  style={{ width: "100%", paddingLeft: "40px", paddingRight: "16px", paddingTop: "10px", paddingBottom: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", color: "#0f172a", outline: "none" }}
                  onFocus={(e) => e.target.style.borderColor = "#0d9488"}
                  onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "6px" }}>
                Mot de passe
              </label>
              <div style={{ position: "relative" }}>
                <Lock style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#9ca3af" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={{ width: "100%", paddingLeft: "40px", paddingRight: "40px", paddingTop: "10px", paddingBottom: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", color: "#0f172a", outline: "none" }}
                  onFocus={(e) => e.target.style.borderColor = "#0d9488"}
                  onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: "0" }}
                >
                  {showPassword ? <EyeOff style={{ width: "16px", height: "16px" }} /> : <Eye style={{ width: "16px", height: "16px" }} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "11px 16px", background: loading ? "#99f6e4" : "#0d9488", color: "#ffffff", fontWeight: "600", fontSize: "14px", borderRadius: "8px", border: "none", cursor: loading ? "not-allowed" : "pointer", transition: "background 0.2s", marginTop: "8px" }}
              onMouseEnter={(e) => { if (!loading) e.target.style.background = "#0f766e"; }}
              onMouseLeave={(e) => { if (!loading) e.target.style.background = "#0d9488"; }}
            >
              {loading ? "Chargement..." : mode === "login" ? "Se connecter" : "Creer le compte"}
            </button>
          </form>

          <p style={{ marginTop: "24px", textAlign: "center", fontSize: "13px", color: "#64748b" }}>
            {mode === "login" ? (
              <>
                Pas encore de compte ?{" "}
                <button onClick={() => { setMode("signup"); setError(""); }} style={{ color: "#0d9488", fontWeight: "600", background: "none", border: "none", cursor: "pointer", fontSize: "13px" }}>
                  Creer un compte
                </button>
              </>
            ) : (
              <>
                Deja un compte ?{" "}
                <button onClick={() => { setMode("login"); setError(""); }} style={{ color: "#0d9488", fontWeight: "600", background: "none", border: "none", cursor: "pointer", fontSize: "13px" }}>
                  Se connecter
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
