import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "super_admin";
  emailVerified: boolean;
  createdAt: string;
  topicsStarted: number;
  topicsCompleted: number;
}

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [otpByUser, setOtpByUser] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch("/admin/users");
    setUsers(data.users);
  }

  useEffect(() => {
    apiFetch("/profile").then((p) => setMyRole(p.role));
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  async function setRole(userId: string, role: "user" | "admin") {
    try {
      await apiFetch(`/admin/users/${userId}/role`, { method: "POST", body: JSON.stringify({ role }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function viewOtp(userId: string) {
    try {
      const data = await apiFetch(`/admin/users/${userId}/otp`);
      setOtpByUser((s) => ({ ...s, [userId]: `${data.code} (expires ${new Date(data.expiresAt).toLocaleTimeString()})` }));
    } catch (err) {
      setOtpByUser((s) => ({ ...s, [userId]: err instanceof Error ? err.message : "No active OTP" }));
    }
  }

  const isSuperAdmin = myRole === "super_admin";

  return (
    <div className="max-w-4xl mx-auto mt-12 space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Verified</th>
            <th>Topics started</th>
            <th>Topics completed</th>
            {isSuperAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="py-2">{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.emailVerified ? "yes" : "no"}</td>
              <td>{u.topicsStarted}</td>
              <td>{u.topicsCompleted}</td>
              {isSuperAdmin && (
                <td className="space-x-2">
                  {u.role !== "super_admin" && (
                    <button
                      onClick={() => setRole(u.id, u.role === "admin" ? "user" : "admin")}
                      className="text-xs underline"
                    >
                      {u.role === "admin" ? "Revoke admin" : "Make admin"}
                    </button>
                  )}
                  <button onClick={() => viewOtp(u.id)} className="text-xs underline">
                    View OTP
                  </button>
                  {otpByUser[u.id] && <div className="text-xs text-gray-600">{otpByUser[u.id]}</div>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
