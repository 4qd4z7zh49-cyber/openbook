"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  username: string | null;
  role: string | null;
  invitation_code: string | null;
  managed_by: string | null;
  deposit_addresses?: {
    USDT?: string;
    BTC?: string;
    ETH?: string;
    SOL?: string;
    XRP?: string;
  };
  created_at?: string | null;
};

type ChangePasswordResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function shortAddress(v?: string) {
  const s = String(v || "").trim();
  if (!s) return "-";
  if (s.length <= 22) return s;
  return `${s.slice(0, 10)}...${s.slice(-8)}`;
}

export default function ManageAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [changePasswordErr, setChangePasswordErr] = useState("");
  const [changePasswordInfo, setChangePasswordInfo] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/subadmins");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to load");
      setRows(Array.isArray(j?.subadmins) ? j.subadmins : []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setCreating(true);
    setErr("");
    setNewInvite(null);
    try {
      const r = await fetch("/api/admin/subadmins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Create failed");

      setNewInvite(j?.subadmin?.invitation_code ?? null);
      setUsername("");
      setPassword("");
      await load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Create failed";
      setErr(message);
    } finally {
      setCreating(false);
    }
  }

  async function copyAddress(value: string, key: string) {
    const v = String(value || "").trim();
    if (!v || v === "-") return;
    try {
      await navigator.clipboard.writeText(v);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? "" : prev));
      }, 1200);
    } catch {
      setErr("Copy failed");
    }
  }

  async function changeMyPassword() {
    setChangingPassword(true);
    setChangePasswordErr("");
    setChangePasswordInfo("");
    try {
      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters");
      }
      if (newPassword !== confirmNewPassword) {
        throw new Error("New password and confirm password do not match");
      }

      const r = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const j = (await r.json().catch(() => ({}))) as ChangePasswordResponse;
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to change password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setChangePasswordInfo("Password updated successfully.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to change password";
      setChangePasswordErr(message);
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Manage Admin</div>
        <p className="mt-2 text-white/60">Create sub-admin accounts + generate invitation codes.</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-lg font-semibold">Create Sub-admin</div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={create}
            disabled={creating || username.trim().length < 3 || password.length < 4}
            className="rounded-xl bg-blue-600 px-4 py-2 font-semibold disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create + Generate code"}
          </button>

          {newInvite ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <span className="text-white/60">Invitation:</span>{" "}
              <span className="font-semibold">{newInvite}</span>
            </div>
          ) : null}

          <button
            onClick={load}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2"
          >
            Refresh
          </button>
        </div>

        {err ? <div className="mt-3 text-red-400">{err}</div> : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-lg font-semibold">Change My Password</div>
        <p className="mt-2 text-sm text-white/60">
          Use your current password, then set a new one. For `superadmin`, this replaces
          `YOUR_ADMIN_PASSWORD!`.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            placeholder="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            placeholder="New password (min 8)"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            placeholder="Confirm new password"
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={changeMyPassword}
            disabled={
              changingPassword ||
              !currentPassword ||
              newPassword.length < 8 ||
              confirmNewPassword.length < 8
            }
            className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold disabled:opacity-60"
          >
            {changingPassword ? "Updating..." : "Update Password"}
          </button>
        </div>

        {changePasswordErr ? <div className="mt-3 text-red-400">{changePasswordErr}</div> : null}
        {changePasswordInfo ? <div className="mt-3 text-emerald-300">{changePasswordInfo}</div> : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 text-lg font-semibold">Sub-admin list</div>

        {loading ? <div className="text-white/60">Loading...</div> : null}
        {!loading && rows.length === 0 ? <div className="text-white/60">No sub-admins.</div> : null}

        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px]">
              <thead>
                <tr className="text-left text-white/60">
                  <th className="py-3">USERNAME</th>
                  <th className="py-3">INVITE</th>
                  <th className="py-3">USDT ADDRESS</th>
                  <th className="py-3">BTC ADDRESS</th>
                  <th className="py-3">ETH ADDRESS</th>
                  <th className="py-3">SOL ADDRESS</th>
                  <th className="py-3">XRP ADDRESS</th>
                  <th className="py-3">MANAGED BY</th>
                  <th className="py-3 text-right">CREATED</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="py-3">{r.username ?? "-"}</td>
                    <td className="py-3 font-mono">{r.invitation_code ?? "-"}</td>
                    <td className="py-3 font-mono text-xs text-white/70" title={r.deposit_addresses?.USDT || ""}>
                      <div className="flex items-center gap-2">
                        <span>{shortAddress(r.deposit_addresses?.USDT)}</span>
                        {r.deposit_addresses?.USDT ? (
                          <button
                            type="button"
                            onClick={() => copyAddress(r.deposit_addresses?.USDT || "", `${r.id}-USDT`)}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/80 hover:bg-white/10"
                          >
                            {copiedKey === `${r.id}-USDT` ? "Copied" : "Copy"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs text-white/70" title={r.deposit_addresses?.BTC || ""}>
                      <div className="flex items-center gap-2">
                        <span>{shortAddress(r.deposit_addresses?.BTC)}</span>
                        {r.deposit_addresses?.BTC ? (
                          <button
                            type="button"
                            onClick={() => copyAddress(r.deposit_addresses?.BTC || "", `${r.id}-BTC`)}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/80 hover:bg-white/10"
                          >
                            {copiedKey === `${r.id}-BTC` ? "Copied" : "Copy"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs text-white/70" title={r.deposit_addresses?.ETH || ""}>
                      <div className="flex items-center gap-2">
                        <span>{shortAddress(r.deposit_addresses?.ETH)}</span>
                        {r.deposit_addresses?.ETH ? (
                          <button
                            type="button"
                            onClick={() => copyAddress(r.deposit_addresses?.ETH || "", `${r.id}-ETH`)}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/80 hover:bg-white/10"
                          >
                            {copiedKey === `${r.id}-ETH` ? "Copied" : "Copy"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs text-white/70" title={r.deposit_addresses?.SOL || ""}>
                      <div className="flex items-center gap-2">
                        <span>{shortAddress(r.deposit_addresses?.SOL)}</span>
                        {r.deposit_addresses?.SOL ? (
                          <button
                            type="button"
                            onClick={() => copyAddress(r.deposit_addresses?.SOL || "", `${r.id}-SOL`)}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/80 hover:bg-white/10"
                          >
                            {copiedKey === `${r.id}-SOL` ? "Copied" : "Copy"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs text-white/70" title={r.deposit_addresses?.XRP || ""}>
                      <div className="flex items-center gap-2">
                        <span>{shortAddress(r.deposit_addresses?.XRP)}</span>
                        {r.deposit_addresses?.XRP ? (
                          <button
                            type="button"
                            onClick={() => copyAddress(r.deposit_addresses?.XRP || "", `${r.id}-XRP`)}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/80 hover:bg-white/10"
                          >
                            {copiedKey === `${r.id}-XRP` ? "Copied" : "Copy"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 font-mono text-white/70">
                      {r.managed_by ? r.managed_by.slice(0, 12) + "…" : "-"}
                    </td>
                    <td className="py-3 text-right text-white/70">
                      {(r.created_at || "").toString().slice(0, 10) || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
