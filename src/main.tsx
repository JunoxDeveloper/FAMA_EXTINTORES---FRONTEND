import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import DashboardPage from "./DashboardPage.tsx";
import LoginPage from "./LoginPage.tsx";

type UserRole = "worker" | "admin" | "boss";
type UserData = { id: string; username: string; role: UserRole; displayName: string };

function Root() {
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("fama_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem("fama_user"); }
    }
  }, []);

  const handleLogin = (u: UserData) => setUser(u);

  const handleLogout = () => {
    localStorage.removeItem("fama_user");
    setUser(null);
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          user.role === "boss"
            ? <Navigate to="/dashboard" replace />
            : <App user={user} onLogout={handleLogout} />
        } />
        <Route
          path="/dashboard"
          element={
            user.role === "admin" || user.role === "boss"
              ? <DashboardPage user={user} onLogout={handleLogout} />
              : <Navigate to="/" replace />
          }
        />
        <Route path="/app" element={<App user={user} onLogout={handleLogout} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);