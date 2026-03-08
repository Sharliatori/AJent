import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PERF_THRESHOLD = 50;

interface PerfScore {
  strategy: "mobile" | "desktop";
  performance: number;
  fcp: string;
  lcp: string;
  tbt: string;
  cls: string;
  si: string;
}

interface PerfCheckRequest {
  client: {
    id: string;
    name: string;
    url: string;
    domain: string;
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkPerformance(
  url: string,
  strategy: "mobile" | "desktop",
  maxRetries = 3
): Promise<{ score: PerfScore | null; status: string; detail: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const params = new URLSearchParams({
        url,
        strategy,
        category: "performance",
      });

      const apiKey = Deno.env.get("PAGESPEED_API_KEY");
      if (apiKey) params.set("key", apiKey);

      const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
      const res = await fetch(endpoint);

      if (res.status === 429) {
        const waitTime = (attempt + 1) * 15000;
        console.log(`Rate limited (${strategy}), retry ${attempt + 1}/${maxRetries} in ${waitTime / 1000}s`);
        await delay(waitTime);
        continue;
      }

      if (!res.ok) {
        return {
          score: null,
          status: "ERROR",
          detail: `API a repondu ${res.status}: ${res.statusText}`,
        };
      }

      const data = await res.json();
      const lighthouse = data.lighthouseResult;
      const audits = lighthouse.audits;
      const rawScore = lighthouse.categories?.performance?.score ?? 0;
      const scoreVal = Math.round(rawScore * 100);

      const perfScore: PerfScore = {
        strategy,
        performance: scoreVal,
        fcp: audits["first-contentful-paint"]?.displayValue ?? "-",
        lcp: audits["largest-contentful-paint"]?.displayValue ?? "-",
        tbt: audits["total-blocking-time"]?.displayValue ?? "-",
        cls: audits["cumulative-layout-shift"]?.displayValue ?? "-",
        si: audits["speed-index"]?.displayValue ?? "-",
      };

      const status =
        scoreVal < PERF_THRESHOLD
          ? "ERROR"
          : scoreVal < 70
          ? "WARNING"
          : "OK";

      return {
        score: perfScore,
        status,
        detail: `Score: ${scoreVal}/100 | FCP: ${perfScore.fcp} | LCP: ${perfScore.lcp} | TBT: ${perfScore.tbt} | CLS: ${perfScore.cls}`,
      };
    } catch (err: any) {
      if (attempt === maxRetries - 1) {
        return {
          score: null,
          status: "ERROR",
          detail: `Erreur: ${err.message || "inconnue"}`,
        };
      }
      await delay((attempt + 1) * 5000);
    }
  }

  return {
    score: null,
    status: "ERROR",
    detail: "Nombre maximum de tentatives atteint (rate limit)",
  };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const { client }: PerfCheckRequest = await req.json();
    const issues: string[] = [];

    const mobileResult = await checkPerformance(client.url, "mobile");
    await delay(5000);
    const desktopResult = await checkPerformance(client.url, "desktop");

    if (mobileResult.status === "ERROR") {
      issues.push(`Perf mobile: ${mobileResult.detail}`);
    } else if (mobileResult.status === "WARNING") {
      issues.push(
        `Perf mobile faible: ${mobileResult.score?.performance}/100`
      );
    }

    if (desktopResult.status === "ERROR") {
      issues.push(`Perf desktop: ${desktopResult.detail}`);
    } else if (desktopResult.status === "WARNING") {
      issues.push(
        `Perf desktop faible: ${desktopResult.score?.performance}/100`
      );
    }

    const result = {
      clientId: client.id,
      clientName: client.name,
      url: client.url,
      domain: client.domain,
      checkedAt: new Date().toISOString(),
      mobile: mobileResult.score,
      desktop: desktopResult.score,
      mobileStatus: mobileResult.status,
      desktopStatus: desktopResult.status,
      mobileDetail: mobileResult.detail,
      desktopDetail: desktopResult.detail,
      issues,
    };

    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabase.from("performance_results").insert({
        client_id: client.id,
        domain: client.domain,
        mobile_score: mobileResult.score?.performance ?? 0,
        desktop_score: desktopResult.score?.performance ?? 0,
        mobile_details: mobileResult.score ?? {},
        desktop_details: desktopResult.score ?? {},
        issues,
        checked_at: result.checkedAt,
      });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      await supabase
        .from("performance_results")
        .delete()
        .eq("client_id", client.id)
        .lt("checked_at", sevenDaysAgo.toISOString());
    } catch (dbErr) {
      console.error("Database error:", dbErr);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    console.error("Error in perf-check function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
