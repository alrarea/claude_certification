import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Spark } from "./Spark";
import { useAuth } from "../lib/AuthContext";

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const location = useLocation();
  const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
  return (
    <Link to={to} className={`nav-link ${active ? "active" : ""}`}>
      {children}
    </Link>
  );
}

export function AppShell({ children, maxWidth = 720 }: { children: ReactNode; maxWidth?: number }) {
  const { logout } = useAuth();

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-cream)" }}>
      <header className="app-nav">
        <div
          className="flex items-center justify-between"
          style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px", height: 64 }}
        >
          <Link to="/learn/ccaf" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
            <Spark size={18} spinning={false} />
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--color-ink)" }}>
              Cert Prep
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/learn/ccaf">Learn</NavLink>
            <NavLink to="/exam/new">Exam</NavLink>
            <NavLink to="/questions/manage">Questions</NavLink>
            <NavLink to="/profile">Profile</NavLink>
          </nav>
          <button className="nav-link" style={{ border: "none", background: "transparent", cursor: "pointer" }} onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main style={{ maxWidth, margin: "0 auto", padding: "48px 24px" }}>{children}</main>
    </div>
  );
}
