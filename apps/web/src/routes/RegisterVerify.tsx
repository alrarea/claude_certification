import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

export function RegisterVerify() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch("/auth/register/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      login(data.accessToken, data.refreshToken);
      navigate("/learn/ccaf");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    setError(null);
    setResent(false);
    try {
      await apiFetch("/auth/register/resend", { method: "POST", body: JSON.stringify({ email }) });
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 space-y-4">
      <h1 className="text-xl font-semibold">Enter verification code</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full border rounded px-3 py-2"
          type="email"
          placeholder="you@alignminds.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {resent && <p className="text-green-600 text-sm">New code sent.</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-50"
        >
          Verify
        </button>
        <button type="button" onClick={onResend} className="w-full text-sm text-gray-600 underline">
          Resend code
        </button>
      </form>
    </div>
  );
}
