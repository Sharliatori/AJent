import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DnsMonitorRequest {
  client: {
    id: string;
    name: string;
    domain: string;
  };
}

async function queryDns(name: string, type: string) {
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { Accept: "application/dns-json" } }
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function checkARecords(domain: string) {
  const result = {
    ok: false,
    records: [] as string[],
    ttl: 0,
    error: null as string | null,
  };

  const data = await queryDns(domain, "A");
  if (data?.Answer) {
    result.records = data.Answer.filter((r: any) => r.type === 1).map(
      (r: any) => r.data
    );
    result.ttl = data.Answer[0]?.TTL || 0;
    result.ok = result.records.length > 0;
  }
  if (!result.ok) result.error = "Aucun enregistrement A trouve";
  return result;
}

async function checkAAAARecords(domain: string) {
  const result = {
    ok: false,
    records: [] as string[],
    error: null as string | null,
  };

  const data = await queryDns(domain, "AAAA");
  if (data?.Answer) {
    result.records = data.Answer.filter((r: any) => r.type === 28).map(
      (r: any) => r.data
    );
    result.ok = result.records.length > 0;
  }
  return result;
}

async function checkNSRecords(domain: string) {
  const result = {
    ok: false,
    records: [] as string[],
    error: null as string | null,
  };

  const data = await queryDns(domain, "NS");
  if (data?.Answer) {
    result.records = data.Answer.filter((r: any) => r.type === 2).map(
      (r: any) => r.data?.replace(/\.$/, "") || r.data
    );
    result.ok = result.records.length > 0;
  }
  if (!result.ok) result.error = "Aucun serveur NS trouve";
  return result;
}

async function checkMXRecords(domain: string) {
  const result = {
    ok: false,
    records: [] as { priority: number; exchange: string }[],
    error: null as string | null,
  };

  const data = await queryDns(domain, "MX");
  if (data?.Answer) {
    result.records = data.Answer.filter((r: any) => r.type === 15)
      .map((r: any) => {
        const parts = (r.data || "").split(/\s+/);
        return {
          priority: parseInt(parts[0]) || 0,
          exchange: (parts[1] || r.data || "").replace(/\.$/, ""),
        };
      })
      .sort((a: any, b: any) => a.priority - b.priority);
    result.ok = result.records.length > 0;
  }
  if (!result.ok) result.error = "Aucun enregistrement MX (emails non configures)";
  return result;
}

async function checkSPF(domain: string) {
  const result = {
    ok: false,
    record: null as string | null,
    mechanisms: [] as string[],
    policy: null as string | null,
    warnings: [] as string[],
    error: null as string | null,
  };

  const data = await queryDns(domain, "TXT");
  if (data?.Answer) {
    const txts = data.Answer.filter((r: any) => r.type === 16).map(
      (r: any) => (r.data || "").replace(/"/g, "")
    );
    const spfRecord = txts.find((t: string) =>
      t.toLowerCase().startsWith("v=spf1")
    );

    if (spfRecord) {
      result.record = spfRecord;
      result.ok = true;

      const parts = spfRecord.split(/\s+/).slice(1);
      result.mechanisms = parts.filter(
        (p: string) => !p.startsWith("~") && !p.startsWith("-") && !p.startsWith("+") && !p.startsWith("?") && p !== "all" && !p.startsWith("all")
      );

      if (spfRecord.includes("-all")) {
        result.policy = "strict (-all)";
      } else if (spfRecord.includes("~all")) {
        result.policy = "softfail (~all)";
        result.warnings.push("SPF utilise ~all (softfail) au lieu de -all (hardfail)");
      } else if (spfRecord.includes("+all") || spfRecord.includes("?all")) {
        result.policy = "permissive";
        result.warnings.push("SPF est trop permissif - tout le monde peut envoyer des emails");
      } else if (!spfRecord.includes("all")) {
        result.policy = "sans directive all";
        result.warnings.push("SPF ne contient pas de directive 'all'");
      }

      const lookupCount = parts.filter(
        (p: string) =>
          p.startsWith("include:") ||
          p.startsWith("a:") ||
          p.startsWith("mx:") ||
          p === "a" ||
          p === "mx" ||
          p.startsWith("redirect=")
      ).length;
      if (lookupCount > 10) {
        result.warnings.push(
          `SPF contient ${lookupCount} lookups DNS (max recommande: 10)`
        );
      }
    }
  }

  if (!result.ok) result.error = "Aucun enregistrement SPF trouve";
  return result;
}

async function checkDMARC(domain: string) {
  const result = {
    ok: false,
    record: null as string | null,
    policy: null as string | null,
    subdomainPolicy: null as string | null,
    reportEmail: null as string | null,
    percentage: 100,
    warnings: [] as string[],
    error: null as string | null,
  };

  const data = await queryDns(`_dmarc.${domain}`, "TXT");
  if (data?.Answer) {
    const txts = data.Answer.filter((r: any) => r.type === 16).map(
      (r: any) => (r.data || "").replace(/"/g, "")
    );
    const dmarcRecord = txts.find((t: string) =>
      t.toLowerCase().startsWith("v=dmarc1")
    );

    if (dmarcRecord) {
      result.record = dmarcRecord;
      result.ok = true;

      const pMatch = dmarcRecord.match(/;\s*p=(\w+)/i);
      if (pMatch) {
        result.policy = pMatch[1].toLowerCase();
        if (result.policy === "none") {
          result.warnings.push(
            "DMARC policy est 'none' - les emails echouant la verification ne sont pas bloques"
          );
        }
      }

      const spMatch = dmarcRecord.match(/;\s*sp=(\w+)/i);
      if (spMatch) {
        result.subdomainPolicy = spMatch[1].toLowerCase();
      }

      const ruaMatch = dmarcRecord.match(/;\s*rua=mailto:([^\s;]+)/i);
      if (ruaMatch) {
        result.reportEmail = ruaMatch[1];
      } else {
        result.warnings.push(
          "Aucune adresse de rapport (rua) configuree dans DMARC"
        );
      }

      const pctMatch = dmarcRecord.match(/;\s*pct=(\d+)/i);
      if (pctMatch) {
        result.percentage = parseInt(pctMatch[1]);
        if (result.percentage < 100) {
          result.warnings.push(
            `DMARC ne couvre que ${result.percentage}% des emails`
          );
        }
      }
    }
  }

  if (!result.ok) result.error = "Aucun enregistrement DMARC trouve";
  return result;
}

async function checkDKIM(domain: string) {
  const selectors = [
    "default",
    "google",
    "mail",
    "dkim",
    "selector1",
    "selector2",
    "k1",
    "s1",
    "s2",
    "mandrill",
    "everlytickey1",
    "everlytickey2",
    "mailjet",
    "pm",
  ];

  const result = {
    ok: false,
    selectorsChecked: selectors,
    foundSelectors: [] as string[],
    records: [] as { selector: string; record: string }[],
    error: null as string | null,
  };

  const checks = await Promise.all(
    selectors.map(async (selector) => {
      const data = await queryDns(
        `${selector}._domainkey.${domain}`,
        "TXT"
      );
      if (data?.Answer && data.Answer.length > 0) {
        const txt = data.Answer.filter((r: any) => r.type === 16)
          .map((r: any) => (r.data || "").replace(/"/g, ""))
          .join("");
        if (txt && (txt.includes("v=DKIM1") || txt.includes("p="))) {
          return { selector, record: txt };
        }
      }
      return null;
    })
  );

  for (const check of checks) {
    if (check) {
      result.foundSelectors.push(check.selector);
      result.records.push(check);
      result.ok = true;
    }
  }

  if (!result.ok) result.error = "Aucun selecteur DKIM trouve";
  return result;
}

function calculateScore(
  aResult: any,
  mxResult: any,
  spfResult: any,
  dmarcResult: any,
  dkimResult: any
) {
  let score = 0;
  const maxScore = 100;

  if (aResult.ok) score += 10;
  if (mxResult.ok) score += 20;

  if (spfResult.ok) {
    score += 20;
    if (spfResult.policy === "strict (-all)") score += 5;
    if (spfResult.warnings.length > 0) score -= spfResult.warnings.length * 2;
  }

  if (dmarcResult.ok) {
    score += 20;
    if (dmarcResult.policy === "reject") score += 5;
    else if (dmarcResult.policy === "quarantine") score += 3;
    if (dmarcResult.reportEmail) score += 2;
    if (dmarcResult.warnings.length > 0)
      score -= dmarcResult.warnings.length * 2;
  }

  if (dkimResult.ok) {
    score += 20;
    if (dkimResult.foundSelectors.length > 1) score += 3;
  }

  return Math.max(0, Math.min(maxScore, score));
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const { client }: DnsMonitorRequest = await req.json();
    const domain = client.domain;
    const issues: string[] = [];

    const [aResult, aaaaResult, nsResult, mxResult, spfResult, dmarcResult, dkimResult] =
      await Promise.all([
        checkARecords(domain),
        checkAAAARecords(domain),
        checkNSRecords(domain),
        checkMXRecords(domain),
        checkSPF(domain),
        checkDMARC(domain),
        checkDKIM(domain),
      ]);

    if (!aResult.ok) issues.push("DNS: Aucun enregistrement A");
    if (!mxResult.ok) issues.push("EMAIL: Aucun enregistrement MX configure");
    if (!spfResult.ok) issues.push("EMAIL: SPF absent - risque de spam");
    if (spfResult.warnings.length > 0) {
      spfResult.warnings.forEach((w: string) => issues.push(`SPF: ${w}`));
    }
    if (!dmarcResult.ok) issues.push("EMAIL: DMARC absent - risque d'usurpation");
    if (dmarcResult.warnings.length > 0) {
      dmarcResult.warnings.forEach((w: string) => issues.push(`DMARC: ${w}`));
    }
    if (!dkimResult.ok) issues.push("EMAIL: DKIM non detecte");

    const overallScore = calculateScore(
      aResult,
      mxResult,
      spfResult,
      dmarcResult,
      dkimResult
    );

    const result = {
      clientId: client.id,
      clientName: client.name,
      domain,
      checkedAt: new Date().toISOString(),
      dns_a: aResult,
      dns_aaaa: aaaaResult,
      dns_ns: nsResult,
      dns_mx: mxResult,
      dns_spf: spfResult,
      dns_dmarc: dmarcResult,
      dns_dkim: dkimResult,
      overallScore,
      issues,
    };

    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabase.from("dns_email_results").insert({
        client_id: client.id,
        domain,
        dns_a: aResult,
        dns_aaaa: aaaaResult,
        dns_ns: nsResult,
        dns_mx: mxResult,
        dns_spf: spfResult,
        dns_dmarc: dmarcResult,
        dns_dkim: dkimResult,
        overall_score: overallScore,
        issues,
        checked_at: result.checkedAt,
      });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      await supabase
        .from("dns_email_results")
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
    console.error("Error in dns-monitor function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
