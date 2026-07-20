import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
import AdminAuthGate from "./components/AdminAuthGate.jsx";
import { AuthProvider } from "./portal/AuthContext.jsx";
import ProtectedRoute from "./portal/ProtectedRoute.jsx";
import PortalLayout from "./portal/PortalLayout.jsx";
import LoginPage from "./portal/LoginPage.jsx";
import PortalDashboard from "./portal/pages/PortalDashboard.jsx";
import PortalReports from "./portal/pages/PortalReports.jsx";
import PortalImprovements from "./portal/pages/PortalImprovements.jsx";
import PortalRequests from "./portal/pages/PortalRequests.jsx";
import PortalInterventions from "./portal/pages/PortalInterventions.jsx";
import PortalPayments from "./portal/pages/PortalPayments.jsx";
import PortalTechnical from "./portal/pages/PortalTechnical.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Admin back-office — protected, only nicolas.sinou@lutecia.ai */}
          <Route path="/" element={<AdminAuthGate><App /></AdminAuthGate>} />
          <Route path="/backoffice" element={<AdminAuthGate><App /></AdminAuthGate>} />

          {/* Client portal */}
          <Route path="/portal/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<PortalLayout />}>
              <Route path="/portal/dashboard" element={<PortalDashboard />} />
              <Route path="/portal/reports" element={<PortalReports />} />
              <Route path="/portal/improvements" element={<PortalImprovements />} />
              <Route path="/portal/requests" element={<PortalRequests />} />
              <Route path="/portal/interventions" element={<PortalInterventions />} />
              <Route path="/portal/payments" element={<PortalPayments />} />
              <Route path="/portal/technical" element={<PortalTechnical />} />
            </Route>
          </Route>
          <Route path="/portal" element={<Navigate to="/portal/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
