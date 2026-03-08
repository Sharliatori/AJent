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
