import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Spark } from "./Spark";
import { useAuth } from "../lib/AuthContext";
import { LanguageSwitch } from "./LanguageSwitch";

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
        {/* Sizing lives in CSS, not inline, so the narrow-screen rules can
            reach it - an inline height and padding would win over them. */}
        <div className="app-nav-inner flex items-center justify-between">
          <Link to="/learn" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
            <Spark size={18} spinning={false} />
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--color-ink)" }}>
              Cert Prep
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/learn">Learn</NavLink>
            <NavLink to="/exam/new">Exam</NavLink>
            <NavLink to="/questions/manage">Questions</NavLink>
            <NavLink to="/profile">Profile</NavLink>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <button className="nav-link" style={{ border: "none", background: "transparent", cursor: "pointer" }} onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main style={{ maxWidth, margin: "0 auto", padding: "48px 24px" }}>{children}</main>
    </div>
  );
}
