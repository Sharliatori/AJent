# Snippet — Ajout Performance (PageSpeed Insights)

## 1. Variable d'environnement (optionnelle mais recommandée)

| Variable              | Valeur                                                        |
| --------------------- | ------------------------------------------------------------- |
| `PAGESPEED_API_KEY`   | Clé gratuite → [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) |

---

## 2. Ajouter l'URL au config des domaines

```ts
const DOMAINS_TO_MONITOR = [
  {
    domain: "r2sbat.fr",
    dkimSelector: "default",
    clientName: "R2S Bâtiment",
    url: "https://r2sbat.fr", // ← ajouter cette ligne
  },
];
```

---

## 3. Constante seuil d'alerte

```ts
const PERF_THRESHOLD = 50; // Alerte si score < 50
```

---

## 4. Fonction checkPerformance

À ajouter après les autres fonctions `check*` :

```ts
interface PerfScore {
  strategy: "mobile" | "desktop";
  performance: number;
  fcp: string;   // First Contentful Paint
  lcp: string;   // Largest Contentful Paint
  tbt: string;   // Total Blocking Time
  cls: string;   // Cumulative Layout Shift
  si: string;    // Speed Index
}

async function checkPerformance(
  url: string
): Promise<{ mobile: PerfScore | null; desktop: PerfScore | null; checks: CheckResult[] }> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  const checks: CheckResult[] = [];
  let mobile: PerfScore | null = null;
  let desktop: PerfScore | null = null;

  for (const strategy of ["mobile", "desktop"] as const) {
    try {
      const params = new URLSearchParams({
        url,
        strategy,
        category: "performance",
      });
      if (apiKey) params.set("key", apiKey);

      const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
      const res = await fetch(endpoint);

      if (!res.ok) {
        checks.push({
          name: `Perf (${strategy})`,
          status: "ERROR",
          detail: `API a répondu ${res.status}: ${res.statusText}`,
        });
        continue;
      }

      const data = await res.json();
      const lighthouse = data.lighthouseResult;
      const audits = lighthouse.audits;
      const score = Math.round((lighthouse.categories.performance.score ?? 0) * 100);

      const perfScore: PerfScore = {
        strategy,
        performance: score,
        fcp: audits["first-contentful-paint"]?.displayValue ?? "—",
        lcp: audits["largest-contentful-paint"]?.displayValue ?? "—",
        tbt: audits["total-blocking-time"]?.displayValue ?? "—",
        cls: audits["cumulative-layout-shift"]?.displayValue ?? "—",
        si: audits["speed-index"]?.displayValue ?? "—",
      };

      if (strategy === "mobile") mobile = perfScore;
      else desktop = perfScore;

      const status = score < PERF_THRESHOLD ? "ERROR" : score < 70 ? "WARNING" : "OK";

      checks.push({
        name: `Perf (${strategy})`,
        status,
        detail: `Score: ${score}/100 — FCP: ${perfScore.fcp} · LCP: ${perfScore.lcp} · TBT: ${perfScore.tbt} · CLS: ${perfScore.cls}`,
      });
    } catch (err) {
      checks.push({
        name: `Perf (${strategy})`,
        status: "ERROR",
        detail: `Erreur: ${err instanceof Error ? err.message : "inconnue"}`,
      });
    }
  }

  return { mobile, desktop, checks };
}
```

---

## 5. Intégrer dans `checkDomain`

Remplacer la fonction `checkDomain` :

```ts
async function checkDomain(config: {
  domain: string;
  dkimSelector: string;
  clientName: string;
  url: string;
}): Promise<DomainReport> {
  // DNS & Email checks (en parallèle)
  const dnsChecks = await Promise.all([
    checkDNS(config.domain),
    checkMX(config.domain),
    checkSPF(config.domain),
    checkDMARC(config.domain),
    checkDKIM(config.domain, config.dkimSelector),
  ]);

  // Performance checks (séquentiel — l'API prend ~10-20s par stratégie)
  const perf = await checkPerformance(config.url);

  const checks = [...dnsChecks, ...perf.checks];

  return {
    domain: config.domain,
    clientName: config.clientName,
    checks,
    hasErrors: checks.some((c) => c.status === "ERROR" || c.status === "WARNING"),
    timestamp: new Date().toISOString(),
  };
}
```

---

## Résultat dans le rapport email

Le rapport inclura deux lignes supplémentaires :

| Vérification   | Statut | Détail                                                     |
| -------------- | ------ | ---------------------------------------------------------- |
| Perf (mobile)  | ✅ OK  | Score: 92/100 — FCP: 1.2s · LCP: 2.1s · TBT: 50ms · CLS: 0.01 |
| Perf (desktop) | ✅ OK  | Score: 98/100 — FCP: 0.6s · LCP: 1.0s · TBT: 10ms · CLS: 0.00 |

> **Attention** : chaque appel PageSpeed prend ~10-20 secondes. Avec mobile + desktop, ça ajoute ~30-40s d'exécution. Reste bien sous la limite de 10 minutes des Netlify Functions.
