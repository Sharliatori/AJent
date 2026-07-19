import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import {
  CloudCog, LayoutDashboard, FileText, TrendingUp,
  MessageSquare, Wrench, CreditCard, Cpu,
  LogOut, Menu, X, ChevronLeft
} from "lucide-react";

const navItems = [
  { to: "/portal/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/portal/reports", icon: FileText, label: "Rapports" },
  { to: "/portal/improvements", icon: TrendingUp, label: "Ameliorations" },
  { to: "/portal/requests", icon: MessageSquare, label: "Demandes" },
  { to: "/portal/interventions", icon: Wrench, label: "Interventions" },
  { to: "/portal/payments", icon: CreditCard, label: "Paiements" },
  { to: "/portal/technical", icon: Cpu, label: "Technique" },
];

export default function PortalLayout() {
  const { clientUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const siteName = clientUser?.clients?.name || "Mon site";

  async function handleLogout() {
    await signOut();
    navigate("/portal/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col
          bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-[68px]" : "w-64"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className={`flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-700 ${collapsed ? "justify-center" : ""}`}>
          <CloudCog className="w-6 h-6 text-teal-600 flex-shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold text-slate-900 dark:text-white truncate">
              Lutec<span className="text-teal-600">.IA</span>
            </span>
          )}
        </div>

        {!collapsed && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Site</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
              {siteName}
            </p>
          </div>
        )}

        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium
                ${isActive
                  ? "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white"
                }
                ${collapsed ? "justify-center" : ""}
                `
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-700 p-3">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition ${collapsed ? "justify-center" : ""}`}
            title="Deconnexion"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Deconnexion</span>}
          </button>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition"
        >
          <ChevronLeft className={`w-3.5 h-3.5 text-slate-500 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
              {siteName}
            </h1>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
