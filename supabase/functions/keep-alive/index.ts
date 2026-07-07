import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Ping the database with a lightweight query
    const { error: pingError } = await supabase
      .from("clients")
      .select("id")
      .limit(1);

    if (pingError) {
      throw new Error(`DB ping failed: ${pingError.message}`);
    }

    const pingedAt = new Date().toISOString();

    // Insert a log entry
    const { error: insertError } = await supabase
      .from("keepalive_log")
      .insert({ status: "manual", pinged_at: pingedAt });

    if (insertError) {
      throw new Error(`Log insert failed: ${insertError.message}`);
    }

    // Purge log entries older than 30 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    await supabase
      .from("keepalive_log")
      .delete()
      .lt("pinged_at", cutoff.toISOString());

    return new Response(
      JSON.stringify({ success: true, pinged_at: pingedAt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Keep-alive error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
