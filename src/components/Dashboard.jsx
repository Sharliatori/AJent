import { useState } from "react";
import ClientCard from "./ClientCard";
import { clientsService } from "../lib/supabase";

export default function Dashboard({ clients, setClients, results, loading, onCheck, onCheckAll }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    url: "",
    domain: "",
    tags: "",
  });

  const handleAdd = async () => {
    if (!newClient.name || !newClient.url || !newClient.domain) {
      alert("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      const client = {
        name: newClient.name,
        url: newClient.url,
        domain: newClient.domain,
        tags: newClient.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };

      const created = await clientsService.create(client);
      setClients([...clients, created]);
      setNewClient({ name: "", url: "", domain: "", tags: "" });
      setShowAddForm(false);
    } catch (err) {
      console.error("Failed to add client:", err);
      alert("Erreur lors de l'ajout du client");
    }
  };

  const handleRemove = async (id) => {
    if (confirm("Supprimer ce client ?")) {
      try {
        await clientsService.delete(id);
        setClients(clients.filter((c) => c.id !== id));
      } catch (err) {
        console.error("Failed to remove client:", err);
        alert("Erreur lors de la suppression du client");
      }
    }
  };

  const allLoading = Object.values(loading).some((l) => l);
  const hasResults = Object.keys(results).length > 0;

  const okCount = Object.values(results).filter(
    (r) => !r.issues || r.issues.length === 0
  ).length;
  const issueCount = Object.values(results).filter(
    (r) => r.issues && r.issues.length > 0
  ).length;

  return (
    <div>
      {/* ─── Stats bar ─── */}
      {hasResults && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 24,
            padding: 16,
            background: "var(--bg2)",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 4 }}>
              TOTAL SITES
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "var(--mono)" }}>
              {clients.length}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 4 }}>
              OPÉRATIONNELS
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "var(--mono)", color: "var(--ok)" }}>
              {okCount}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 4 }}>
              AVEC ALERTES
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "var(--mono)", color: issueCount > 0 ? "var(--danger)" : "var(--text3)" }}>
              {issueCount}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", marginBottom: 4 }}>
              VÉRIFICATIONS
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "var(--mono)" }}>
              {Object.keys(results).length}
            </div>
          </div>
        </div>
      )}

      {/* ─── Actions bar ─── */}
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
          CLIENTS MONITORÉS ({clients.length})
        </h2>
        <button
          className="btn btn-secondary"
          onClick={onCheckAll}
          disabled={allLoading || clients.length === 0}
        >
          {allLoading && <span className="spinner" />}
          ↻ Tout vérifier
        </button>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          + Ajouter un client
        </button>
      </div>

      {/* ─── Add form ─── */}
      {showAddForm && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            borderColor: "var(--accent)",
          }}
        >
          <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
            Nouveau client
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="label">Nom *</label>
              <input
                className="input"
                placeholder="Mon Client"
                value={newClient.name}
                onChange={(e) =>
                  setNewClient({ ...newClient, name: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label className="label">URL complète *</label>
              <input
                className="input"
                placeholder="https://example.com"
                value={newClient.url}
                onChange={(e) =>
                  setNewClient({ ...newClient, url: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label className="label">Domaine *</label>
              <input
                className="input"
                placeholder="example.com"
                value={newClient.domain}
                onChange={(e) =>
                  setNewClient({ ...newClient, domain: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label className="label">Tags (séparés par virgule)</label>
              <input
                className="input"
                placeholder="vitrine, e-commerce"
                value={newClient.tags}
                onChange={(e) =>
                  setNewClient({ ...newClient, tags: e.target.value })
                }
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleAdd}>
              Ajouter
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowAddForm(false);
                setNewClient({ name: "", url: "", domain: "", tags: "" });
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ─── Clients list ─── */}
      {clients.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--text3)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>◈</div>
          <p style={{ fontSize: 14 }}>
            Aucun client ajouté. Commencez par ajouter un site à monitorer.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              result={results[client.id]}
              isLoading={loading[client.id]}
              onCheck={() => onCheck(client)}
              onRemove={() => handleRemove(client.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
