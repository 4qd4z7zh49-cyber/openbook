"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  username: string | null;
  role: string | null;
  invitation_code: string | null;
  managed_by: string | null;
  created_at?: string | null;
};

type ChangePasswordResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

type SubadminResetPasswordResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export default function ManageAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

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
  const [resettingSubadminId, setResettingSubadminId] = useState("");
  const [subadminResetErr, setSubadminResetErr] = useState("");
  const [subadminResetInfo, setSubadminResetInfo] = useState("");

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

  async function resetSubadminPassword(row: Row) {
    const name = String(row.username || "sub-admin");
    const input = window.prompt(`Set new password for ${name} (minimum 8 characters).`, "");
    if (input === null) return;

    const newPassword = String(input);
    if (newPassword.length < 8) {
      setSubadminResetErr("New password must be at least 8 characters.");
      setSubadminResetInfo("");
      return;
    }
    if (newPassword.length > 72) {
      setSubadminResetErr("New password must be at most 72 characters.");
      setSubadminResetInfo("");
      return;
    }

    const confirmPassword = window.prompt(`Confirm new password for ${name}.`, "");
    if (confirmPassword === null) return;
    if (confirmPassword !== newPassword) {
      setSubadminResetErr("Confirm password does not match.");
      setSubadminResetInfo("");
      return;
    }

    setResettingSubadminId(row.id);
    setSubadminResetErr("");
    setSubadminResetInfo("");

    try {
      const res = await fetch("/api/admin/subadmins/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subadminId: row.id,
          newPassword,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as SubadminResetPasswordResponse;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to reset sub-admin password");
      }

      setSubadminResetInfo(`Password reset completed for ${name}.`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to reset sub-admin password";
      setSubadminResetErr(message);
    } finally {
      setResettingSubadminId("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div
          className="text-2xl font-semibold"
          style={{
            color: "#ecfeff",
            textShadow:
              "0 0 6px rgba(34,211,238,0.85), 0 0 14px rgba(59,130,246,0.55), 0 0 24px rgba(217,70,239,0.35)",
          }}
        >
          Manage Subadmin
        </div>
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
            <table className="w-full min-w-[940px]">
              <thead>
                <tr className="text-left text-white/60">
                  <th className="py-3">USERNAME</th>
                  <th className="py-3">INVITE</th>
                  <th className="py-3">MANAGED BY</th>
                  <th className="py-3 text-center">CHANGE PASSWORD</th>
                  <th className="py-3 text-right">CREATED</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const busy = resettingSubadminId === r.id;
                  return (
                    <tr key={r.id} className="border-t border-white/10">
                      <td className="py-3">{r.username ?? "-"}</td>
                      <td className="py-3 font-mono">{r.invitation_code ?? "-"}</td>
                      <td className="py-3 font-mono text-white/70">
                        {r.managed_by ? r.managed_by.slice(0, 12) + "…" : "-"}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void resetSubadminPassword(r)}
                          className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-60"
                        >
                          {busy ? "Resetting..." : "Change Password"}
                        </button>
                      </td>
                      <td className="py-3 text-right text-white/70">
                        {(r.created_at || "").toString().slice(0, 10) || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {subadminResetErr ? <div className="mt-3 text-red-400">{subadminResetErr}</div> : null}
        {subadminResetInfo ? <div className="mt-3 text-emerald-300">{subadminResetInfo}</div> : null}
      </div>
    </div>
  );
}
