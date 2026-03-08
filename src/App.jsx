import { useState, useCallback, useEffect } from "react";
import defaultClients from "./data/clients.json";
import Dashboard from "./components/Dashboard";
import ReportView from "./components/ReportView";
import SettingsPanel from "./components/SettingsPanel";
import DnsEmailPanel from "./components/DnsEmailPanel";
import { clientsService, smtpService } from "./lib/supabase";
import { checkSiteViaEdge } from "./lib/checkSiteEdge";
import { checkDnsViaEdge } from "./lib/checkDnsEdge";
import { checkPerfViaEdge } from "./lib/checkPerfEdge";
import PerformancePanel from "./components/PerformancePanel";
import "./App.css";

export default function App() {
  const [clients, setClients] = useState([]);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [view, setView] = useState("dashboard");
  const [smtpConfig, setSmtpConfig] = useState({});
  const [dnsResults, setDnsResults] = useState({});
  const [dnsLoading, setDnsLoading] = useState({});
  const [perfResults, setPerfResults] = useState({});
  const [perfLoading, setPerfLoading] = useState({});
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [clientsData, smtpData] = await Promise.all([
        clientsService.getAll(),
        smtpService.get(),
      ]);

      if (clientsData.length === 0) {
        for (const client of defaultClients) {
          const { id, ...clientWithoutId } = client;
          await clientsService.create(clientWithoutId);
        }
        const reloadedClients = await clientsService.getAll();
        setClients(reloadedClients);
      } else {
        setClients(clientsData);
      }

      if (smtpData) {
        setSmtpConfig({
          host: smtpData.host,
          port: smtpData.port,
          user: smtpData.smtp_user,
          pass: smtpData.smtp_pass,
          alertTo: smtpData.alert_to,
        });
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      setClients(defaultClients);
    } finally {
      setDataLoading(false);
    }
  };

  const checkClient = useCallback(async (client) => {
    setLoading((l) => ({ ...l, [client.id]: true }));
    try {
      const data = await checkSiteViaEdge(client, smtpConfig);
      setResults((r) => ({ ...r, [client.id]: data }));
    } catch (err) {
      console.error("Check client error:", err);
      setResults((r) => ({
        ...r,
        [client.id]: {
          name: client.name,
          url: client.url,
          domain: client.domain,
          checkedAt: new Date().toISOString(),
          error: err.message,
          issues: [`Erreur de connexion à la fonction de monitoring: ${err.message}`],
        },
      }));
    } finally {
      setLoading((l) => ({ ...l, [client.id]: false }));
    }
  }, [smtpConfig]);

  const checkAll = useCallback(async () => {
    for (const client of clients) {
      await checkClient(client);
    }
  }, [clients, checkClient]);

  const checkDns = useCallback(async (client) => {
    setDnsLoading((l) => ({ ...l, [client.id]: true }));
    try {
      const data = await checkDnsViaEdge(client);
      setDnsResults((r) => ({ ...r, [client.id]: data }));
    } catch (err) {
      console.error("DNS check error:", err);
      setDnsResults((r) => ({
        ...r,
        [client.id]: {
          clientName: client.name,
          domain: client.domain,
          checkedAt: new Date().toISOString(),
          overallScore: 0,
          issues: [`Erreur de verification DNS: ${err.message}`],
          dns_a: { ok: false, error: err.message },
          dns_mx: { ok: false },
          dns_spf: { ok: false },
          dns_dmarc: { ok: false },
          dns_dkim: { ok: false },
        },
      }));
    } finally {
      setDnsLoading((l) => ({ ...l, [client.id]: false }));
    }
  }, []);

  const checkAllDns = useCallback(async () => {
    for (const client of clients) {
      await checkDns(client);
    }
  }, [clients, checkDns]);

  const checkPerf = useCallback(async (client) => {
    setPerfLoading((l) => ({ ...l, [client.id]: true }));
    try {
      const data = await checkPerfViaEdge(client);
      setPerfResults((r) => ({ ...r, [client.id]: data }));
    } catch (err) {
      console.error("Perf check error:", err);
      setPerfResults((r) => ({
        ...r,
        [client.id]: {
          clientName: client.name,
          url: client.url,
          domain: client.domain,
          checkedAt: new Date().toISOString(),
          mobile: null,
          desktop: null,
          issues: [`Erreur de test performance: ${err.message}`],
        },
      }));
    } finally {
      setPerfLoading((l) => ({ ...l, [client.id]: false }));
    }
  }, []);

  const checkAllPerf = useCallback(async () => {
    for (const client of clients) {
      await checkPerf(client);
    }
  }, [clients, checkPerf]);

  const saveSmtp = async (config) => {
    if (config.host && config.user && config.pass) {
      await smtpService.save({
        host: config.host,
        port: config.port || 587,
        smtp_user: config.user,
        smtp_pass: config.pass,
        alert_to: config.alertTo || null,
      });
    } else {
      await smtpService.delete();
    }
    setSmtpConfig(config);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">AJent</span>
          </div>
          <nav className="nav">
            <button
              className={`nav-btn ${view === "dashboard" ? "active" : ""}`}
              onClick={() => setView("dashboard")}
            >
              Monitoring
            </button>
            <button
              className={`nav-btn ${view === "dns" ? "active" : ""}`}
              onClick={() => setView("dns")}
            >
              DNS & Email
            </button>
            <button
              className={`nav-btn ${view === "performance" ? "active" : ""}`}
              onClick={() => setView("performance")}
            >
              Performance
            </button>
            <button
              className={`nav-btn ${view === "report" ? "active" : ""}`}
              onClick={() => setView("report")}
            >
              Rapport
            </button>
            <button
              className={`nav-btn ${view === "settings" ? "active" : ""}`}
              onClick={() => setView("settings")}
            >
              Paramètres
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {view === "dashboard" && (
          <Dashboard
            clients={clients}
            setClients={setClients}
            results={results}
            loading={loading}
            onCheck={checkClient}
            onCheckAll={checkAll}
          />
        )}
        {view === "dns" && (
          <DnsEmailPanel
            clients={clients}
            dnsResults={dnsResults}
            dnsLoading={dnsLoading}
            onCheckDns={checkDns}
            onCheckAllDns={checkAllDns}
          />
        )}
        {view === "performance" && (
          <PerformancePanel
            clients={clients}
            perfResults={perfResults}
            perfLoading={perfLoading}
            onCheckPerf={checkPerf}
            onCheckAllPerf={checkAllPerf}
          />
        )}
        {view === "report" && (
          <ReportView clients={clients} results={results} />
        )}
        {view === "settings" && (
          <SettingsPanel smtpConfig={smtpConfig} onSave={saveSmtp} />
        )}
      </main>
    </div>
  );
}
