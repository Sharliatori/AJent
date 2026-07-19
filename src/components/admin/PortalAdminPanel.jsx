import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Users, TrendingUp, Wrench, CreditCard, Cpu, Plus, Trash2, Save, X, CreditCard as Edit2, MessageSquare, Send } from "lucide-react";

export default function PortalAdminPanel({ clients }) {
  const [tab, setTab] = useState("users");

  const tabs = [
    { id: "users", label: "Utilisateurs", icon: Users },
    { id: "improvements", label: "Ameliorations", icon: TrendingUp },
    { id: "requests", label: "Demandes", icon: MessageSquare },
    { id: "interventions", label: "Interventions", icon: Wrench },
    { id: "payments", label: "Paiements", icon: CreditCard },
    { id: "components", label: "Technique", icon: Cpu },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id
                ? "bg-teal-600 text-white"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <ClientUsersAdmin clients={clients} />}
      {tab === "improvements" && <ImprovementsAdmin clients={clients} />}
      {tab === "requests" && <RequestsAdmin clients={clients} />}
      {tab === "interventions" && <InterventionsAdmin clients={clients} />}
      {tab === "payments" && <PaymentsAdmin clients={clients} />}
      {tab === "components" && <ComponentsAdmin clients={clients} />}
    </div>
  );
}

function ClientUsersAdmin({ clients }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [clientId, setClientId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("client_users").select("*, clients(name)").order("created_at", { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    await supabase.from("client_users").delete().eq("id", id);
    load();
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Utilisateurs du portail client</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Associez un utilisateur authentifie (via son auth_user_id Supabase) a un client.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Nom</th>
              <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Client</th>
              <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Auth ID</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.map(u => (
              <tr key={u.id}>
                <td className="py-2 px-3 text-slate-900 dark:text-white">{u.display_name || "-"}</td>
                <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{u.clients?.name || u.client_id}</td>
                <td className="py-2 px-3 text-xs font-mono text-slate-400">{u.auth_user_id?.slice(0, 8)}...</td>
                <td className="py-2 px-3">
                  <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <p className="text-sm text-slate-400">Chargement...</p>}
    </div>
  );
}

function ImprovementsAdmin({ clients }) {
  const [items, setItems] = useState([]);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("pending");
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { load(); }, [clientId]);

  async function load() {
    if (!clientId) return;
    const { data } = await supabase.from("improvement_axes").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    setItems(data || []);
  }

  async function handleSave() {
    if (!title.trim()) return;
    if (editingId) {
      await supabase.from("improvement_axes").update({ title, description, priority, status, updated_at: new Date().toISOString() }).eq("id", editingId);
    } else {
      await supabase.from("improvement_axes").insert({ client_id: clientId, title, description, priority, status });
    }
    resetForm();
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer ?")) return;
    await supabase.from("improvement_axes").delete().eq("id", id);
    load();
  }

  function startEdit(item) {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description || "");
    setPriority(item.priority);
    setStatus(item.status);
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setPriority("medium");
    setStatus("pending");
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <select value={clientId} onChange={e => setClientId(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400" />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400" />
        <select value={priority} onChange={e => setPriority(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
          <option value="high">Haute</option>
          <option value="medium">Moyenne</option>
          <option value="low">Basse</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
          <option value="pending">A traiter</option>
          <option value="in-progress">En cours</option>
          <option value="done">Termine</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium">
          {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {editingId ? "Mettre a jour" : "Ajouter"}
        </button>
        {editingId && (
          <button onClick={resetForm} className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">
            <X className="w-4 h-4" /> Annuler
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {items.map(item => (
          <div key={item.id} className="py-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{item.title}</p>
              <p className="text-xs text-slate-400">{item.priority} | {item.status}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(item)} className="text-slate-400 hover:text-teal-600"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestsAdmin({ clients }) {
  const [requests, setRequests] = useState([]);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [selectedReq, setSelectedReq] = useState(null);
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState("");

  useEffect(() => { load(); }, [clientId]);

  async function load() {
    if (!clientId) return;
    const { data } = await supabase.from("client_requests").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    setRequests(data || []);
  }

  async function openRequest(req) {
    setSelectedReq(req);
    const { data } = await supabase.from("client_request_replies").select("*").eq("request_id", req.id).order("created_at", { ascending: true });
    setReplies(data || []);
  }

  async function sendReply() {
    if (!replyText.trim() || !selectedReq) return;
    await supabase.from("client_request_replies").insert({
      request_id: selectedReq.id,
      author_role: "admin",
      author_name: "Admin",
      message: replyText.trim(),
    });
    setReplyText("");
    openRequest(selectedReq);
  }

  async function updateStatus(id, status) {
    await supabase.from("client_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    load();
    if (selectedReq?.id === id) setSelectedReq({ ...selectedReq, status });
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <select value={clientId} onChange={e => setClientId(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {requests.map(req => (
            <button
              key={req.id}
              onClick={() => openRequest(req)}
              className={`w-full text-left p-3 rounded-lg border transition text-sm ${selectedReq?.id === req.id ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20" : "border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
            >
              <p className="font-medium text-slate-900 dark:text-white truncate">{req.subject}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400">{new Date(req.created_at).toLocaleDateString("fr-FR")}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${req.status === "open" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : req.status === "in-progress" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"}`}>
                  {req.status}
                </span>
              </div>
            </button>
          ))}
          {requests.length === 0 && <p className="text-sm text-slate-400">Aucune demande.</p>}
        </div>

        {selectedReq && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-slate-900 dark:text-white text-sm">{selectedReq.subject}</h4>
              <select
                value={selectedReq.status}
                onChange={e => updateStatus(selectedReq.id, e.target.value)}
                className="text-xs px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300"
              >
                <option value="open">Ouverte</option>
                <option value="in-progress">En cours</option>
                <option value="closed">Fermee</option>
              </select>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{selectedReq.message}</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {replies.map(r => (
                <div key={r.id} className={`p-2 rounded text-xs ${r.author_role === "admin" ? "bg-teal-50 dark:bg-teal-900/20" : "bg-slate-50 dark:bg-slate-700/50"}`}>
                  <span className="font-medium">{r.author_role === "admin" ? "Admin" : r.author_name}</span>: {r.message}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Repondre..."
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400"
                onKeyDown={e => { if (e.key === "Enter") sendReply(); }}
              />
              <button onClick={sendReply} className="p-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InterventionsAdmin({ clients }) {
  const [items, setItems] = useState([]);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planned");
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { load(); }, [clientId]);

  async function load() {
    if (!clientId) return;
    const { data } = await supabase.from("interventions").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    setItems(data || []);
  }

  async function handleSave() {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    if (editingId) {
      const updates = { title, description, status };
      if (status === "in-progress" && !items.find(i => i.id === editingId)?.started_at) updates.started_at = now;
      if (status === "completed") updates.completed_at = now;
      await supabase.from("interventions").update(updates).eq("id", editingId);
    } else {
      const row = { client_id: clientId, title, description, status };
      if (status === "in-progress") row.started_at = now;
      if (status === "completed") { row.started_at = now; row.completed_at = now; }
      await supabase.from("interventions").insert(row);
    }
    resetForm();
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer ?")) return;
    await supabase.from("interventions").delete().eq("id", id);
    load();
  }

  function startEdit(item) {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description || "");
    setStatus(item.status);
  }

  function resetForm() { setEditingId(null); setTitle(""); setDescription(""); setStatus("planned"); }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <select value={clientId} onChange={e => setClientId(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400" />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400" />
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
          <option value="planned">Planifiee</option>
          <option value="in-progress">En cours</option>
          <option value="completed">Terminee</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium">
          {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {editingId ? "Mettre a jour" : "Ajouter"}
        </button>
        {editingId && <button onClick={resetForm} className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-400"><X className="w-4 h-4" /> Annuler</button>}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {items.map(item => (
          <div key={item.id} className="py-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{item.title}</p>
              <p className="text-xs text-slate-400">{item.status}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(item)} className="text-slate-400 hover:text-teal-600"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentsAdmin({ clients }) {
  const [items, setItems] = useState([]);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("pending");
  const [dueDate, setDueDate] = useState("");
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { load(); }, [clientId]);

  async function load() {
    if (!clientId) return;
    const { data } = await supabase.from("payments").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    setItems(data || []);
  }

  async function handleSave() {
    if (!description.trim() || !amount) return;
    const row = { client_id: clientId, description, amount: parseFloat(amount), status, due_date: dueDate || null };
    if (status === "paid") row.paid_at = new Date().toISOString();
    if (editingId) {
      await supabase.from("payments").update(row).eq("id", editingId);
    } else {
      await supabase.from("payments").insert(row);
    }
    resetForm();
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer ?")) return;
    await supabase.from("payments").delete().eq("id", id);
    load();
  }

  function startEdit(item) {
    setEditingId(item.id);
    setDescription(item.description);
    setAmount(String(item.amount));
    setStatus(item.status);
    setDueDate(item.due_date || "");
  }

  function resetForm() { setEditingId(null); setDescription(""); setAmount(""); setStatus("pending"); setDueDate(""); }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <select value={clientId} onChange={e => setClientId(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400" />
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Montant" type="number" step="0.01" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400" />
        <input value={dueDate} onChange={e => setDueDate(e.target.value)} type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white" />
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
          <option value="pending">En attente</option>
          <option value="paid">Payee</option>
          <option value="overdue">En retard</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium">
          {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {editingId ? "Mettre a jour" : "Ajouter"}
        </button>
        {editingId && <button onClick={resetForm} className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-400"><X className="w-4 h-4" /> Annuler</button>}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {items.map(item => (
          <div key={item.id} className="py-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{item.description}</p>
              <p className="text-xs text-slate-400">{Number(item.amount).toFixed(2)} EUR | {item.status}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(item)} className="text-slate-400 hover:text-teal-600"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComponentsAdmin({ clients }) {
  const [items, setItems] = useState([]);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("framework");
  const [version, setVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const [status, setStatus] = useState("up-to-date");
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { load(); }, [clientId]);

  async function load() {
    if (!clientId) return;
    const { data } = await supabase.from("site_components").select("*").eq("client_id", clientId).order("category");
    setItems(data || []);
  }

  async function handleSave() {
    if (!name.trim()) return;
    const row = { client_id: clientId, name, category, version, latest_version: latestVersion, status, updated_at: new Date().toISOString() };
    if (editingId) {
      await supabase.from("site_components").update(row).eq("id", editingId);
    } else {
      await supabase.from("site_components").insert(row);
    }
    resetForm();
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer ?")) return;
    await supabase.from("site_components").delete().eq("id", id);
    load();
  }

  function startEdit(item) {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setVersion(item.version || "");
    setLatestVersion(item.latest_version || "");
    setStatus(item.status);
  }

  function resetForm() { setEditingId(null); setName(""); setCategory("framework"); setVersion(""); setLatestVersion(""); setStatus("up-to-date"); }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <select value={clientId} onChange={e => setClientId(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Composant" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400" />
        <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
          <option value="framework">Framework</option>
          <option value="cms">CMS</option>
          <option value="plugin">Plugin</option>
          <option value="library">Librairie</option>
          <option value="hosting">Hebergement</option>
          <option value="language">Langage</option>
          <option value="database">Base de donnees</option>
        </select>
        <input value={version} onChange={e => setVersion(e.target.value)} placeholder="Version" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400" />
        <input value={latestVersion} onChange={e => setLatestVersion(e.target.value)} placeholder="Derniere version" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400" />
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
          <option value="up-to-date">A jour</option>
          <option value="outdated">Obsolete</option>
          <option value="deprecated">Deprecie</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium">
          {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {editingId ? "Mettre a jour" : "Ajouter"}
        </button>
        {editingId && <button onClick={resetForm} className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-400"><X className="w-4 h-4" /> Annuler</button>}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {items.map(item => (
          <div key={item.id} className="py-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{item.name}</p>
              <p className="text-xs text-slate-400">{item.category} | {item.version} | {item.status}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(item)} className="text-slate-400 hover:text-teal-600"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
