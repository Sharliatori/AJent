import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const clientsService = {
  async getAll() {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(client) {
    const { data, error } = await supabase
      .from("clients")
      .insert([client])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
  },
};

export const monitoringService = {
  async saveResult(clientId, result) {
    const { data, error } = await supabase
      .from("monitoring_results")
      .insert([
        {
          client_id: clientId,
          http_status: result.http || {},
          ssl_status: result.ssl || {},
          dns_status: result.dns || {},
          issues: result.issues || [],
          checked_at: result.checkedAt || new Date().toISOString(),
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getHistory(clientId, limit = 10) {
    const { data, error } = await supabase
      .from("monitoring_results")
      .select("*")
      .eq("client_id", clientId)
      .order("checked_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getLatestForAll() {
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id");
    if (clientsError) throw clientsError;

    const results = {};
    for (const client of clients || []) {
      const { data, error } = await supabase
        .from("monitoring_results")
        .select("*")
        .eq("client_id", client.id)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        results[client.id] = data;
      }
    }
    return results;
  },
};

export const dnsEmailService = {
  async getLatest(clientId) {
    const { data, error } = await supabase
      .from("dns_email_results")
      .select("*")
      .eq("client_id", clientId)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getHistory(clientId, limit = 10) {
    const { data, error } = await supabase
      .from("dns_email_results")
      .select("*")
      .eq("client_id", clientId)
      .order("checked_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getLatestForAll() {
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id");
    if (clientsError) throw clientsError;

    const results = {};
    for (const client of clients || []) {
      const { data, error } = await supabase
        .from("dns_email_results")
        .select("*")
        .eq("client_id", client.id)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        results[client.id] = data;
      }
    }
    return results;
  },
};

export const performanceService = {
  async getLatest(clientId) {
    const { data, error } = await supabase
      .from("performance_results")
      .select("*")
      .eq("client_id", clientId)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getHistory(clientId, limit = 10) {
    const { data, error } = await supabase
      .from("performance_results")
      .select("*")
      .eq("client_id", clientId)
      .order("checked_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getLatestForAll() {
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id");
    if (clientsError) throw clientsError;

    const results = {};
    for (const client of clients || []) {
      const { data, error } = await supabase
        .from("performance_results")
        .select("*")
        .eq("client_id", client.id)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        results[client.id] = data;
      }
    }
    return results;
  },
};

export const keepaliveService = {
  async getLastPing() {
    const { data, error } = await supabase
      .from("keepalive_log")
      .select("*")
      .order("pinged_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async ping() {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/keep-alive`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${response.status}`);
    }
    return response.json();
  },
};

export const smtpService = {
  async get() {
    const { data, error } = await supabase
      .from("smtp_config")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async save(config) {
    const existing = await this.get();
    if (existing) {
      const { data, error } = await supabase
        .from("smtp_config")
        .update(config)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from("smtp_config")
        .insert([config])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async delete() {
    const existing = await this.get();
    if (existing) {
      const { error } = await supabase
        .from("smtp_config")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
    }
  },
};

export const dailySnapshotService = {
  async getLatestSlots() {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("daily_snapshots")
      .select("slot, snapshot_date, checked_at, issues, http_ok, ssl_ok, dns_ok, client_id")
      .eq("snapshot_date", today)
      .order("checked_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async triggerCheck(slot) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-check`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slot }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  },

  async triggerWeeklyReport() {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weekly-report`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  },
};

export const recipientsService = {
  async getAll() {
    const { data, error } = await supabase
      .from("report_recipients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getByClient(clientId) {
    const { data, error } = await supabase
      .from("report_recipients")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getGlobal() {
    const { data, error } = await supabase
      .from("report_recipients")
      .select("*")
      .is("client_id", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(recipient) {
    const res = await fetch(`${supabaseUrl}/functions/v1/manage-recipients`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supabaseAnonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", recipient }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body.data;
  },

  async update(id, updates) {
    const res = await fetch(`${supabaseUrl}/functions/v1/manage-recipients`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supabaseAnonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, updates }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body.data;
  },

  async delete(id) {
    const res = await fetch(`${supabaseUrl}/functions/v1/manage-recipients`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supabaseAnonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  },

  async sendReport(clientId) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-report`;
    const body = clientId ? { client_id: clientId } : {};
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  },
};
