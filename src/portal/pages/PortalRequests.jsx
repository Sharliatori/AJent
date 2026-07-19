import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { supabase } from "../../lib/supabase";
import { MessageSquare, Send, Plus, Clock, CircleCheck as CheckCircle, Loader as Loader2, ChevronDown, ChevronRight } from "lucide-react";

const statusLabels = {
  open: { label: "Ouverte", class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  "in-progress": { label: "En cours", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  closed: { label: "Fermee", class: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" },
};

export default function PortalRequests() {
  const { clientUser, session } = useAuth();
  const clientId = clientUser?.client_id;
  const [requests, setRequests] = useState([]);
  const [replies, setReplies] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    loadRequests();
  }, [clientId]);

  async function loadRequests() {
    try {
      const { data, error } = await supabase
        .from("client_requests")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error("Error loading requests:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadReplies(requestId) {
    const { data, error } = await supabase
      .from("client_request_replies")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    if (!error) {
      setReplies(prev => ({ ...prev, [requestId]: data || [] }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("client_requests").insert({
        client_id: clientId,
        auth_user_id: session.user.id,
        subject: subject.trim(),
        message: message.trim(),
      });
      if (error) throw error;
      setSubject("");
      setMessage("");
      setShowForm(false);
      loadRequests();
    } catch (err) {
      console.error("Error sending request:", err);
    } finally {
      setSending(false);
    }
  }

  async function handleReply(requestId) {
    if (!replyText.trim()) return;
    setReplyLoading(true);
    try {
      const { error } = await supabase.from("client_request_replies").insert({
        request_id: requestId,
        author_role: "client",
        author_name: clientUser?.display_name || session?.user?.email,
        message: replyText.trim(),
      });
      if (error) throw error;
      setReplyText("");
      loadReplies(requestId);
    } catch (err) {
      console.error("Error sending reply:", err);
    } finally {
      setReplyLoading(false);
    }
  }

  function toggleExpand(id) {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      if (!replies[id]) loadReplies(id);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Demandes & Questions</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Envoyez vos demandes ou posez vos questions
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Nouvelle demande
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Sujet</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet de votre demande"
              required
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Decrivez votre demande ou question..."
              required
              rows={4}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
              Annuler
            </button>
            <button type="submit" disabled={sending} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-lg text-sm font-medium transition">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Envoyer
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">Aucune demande pour le moment.</p>
          </div>
        ) : (
          requests.map(req => {
            const sCfg = statusLabels[req.status];
            const isExpanded = expanded === req.id;
            const reqReplies = replies[req.id] || [];
            return (
              <div key={req.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button
                  onClick={() => toggleExpand(req.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition text-left"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{req.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(req.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${sCfg.class}`}>
                    {sCfg.label}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{req.message}</p>
                    {reqReplies.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {reqReplies.map(reply => (
                          <div key={reply.id} className={`p-3 rounded-lg text-sm ${reply.author_role === "admin" ? "bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800" : "bg-slate-50 dark:bg-slate-700/50"}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                                {reply.author_role === "admin" ? "Admin" : reply.author_name || "Vous"}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(reply.created_at).toLocaleString("fr-FR")}
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{reply.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {req.status !== "closed" && (
                      <div className="mt-4 flex gap-2">
                        <input
                          type="text"
                          value={expanded === req.id ? replyText : ""}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Votre reponse..."
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(req.id); } }}
                        />
                        <button
                          onClick={() => handleReply(req.id)}
                          disabled={replyLoading || !replyText.trim()}
                          className="p-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-lg transition"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
