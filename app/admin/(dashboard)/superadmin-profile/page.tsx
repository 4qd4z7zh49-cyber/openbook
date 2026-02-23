"use client";

import { useEffect, useState } from "react";

type SuperadminProfileRow = {
  id: string;
  username: string | null;
  role: string | null;
  invitationCode: string | null;
  createdAt: string | null;
  managedUsersCount: number;
};

type ProfileResponse = {
  ok?: boolean;
  error?: string;
  profile?: SuperadminProfileRow;
};

type ChangePasswordResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

export default function SuperadminProfilePage() {
  const [profile, setProfile] = useState<SuperadminProfileRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteErr, setInviteErr] = useState("");
  const [inviteInfo, setInviteInfo] = useState("");

  const [passwordOpen, setPasswordOpen] = useState(false);
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
      const res = await fetch("/api/admin/superadmin-profile", {
        cache: "no-store",
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as ProfileResponse;
      if (!res.ok || !json?.ok || !json.profile) {
        throw new Error(json?.error || "Failed to load superadmin profile");
      }
      setProfile(json.profile);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load superadmin profile";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function regenerateInviteCode() {
    setInviteBusy(true);
    setInviteErr("");
    setInviteInfo("");
    try {
      const res = await fetch("/api/admin/superadmin-profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate_invite_code" }),
      });
      const json = (await res.json().catch(() => ({}))) as ProfileResponse;
      if (!res.ok || !json?.ok || !json.profile) {
        throw new Error(json?.error || "Failed to regenerate invitation code");
      }
      setProfile(json.profile);
      setInviteInfo("Invitation code updated.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to regenerate invitation code";
      setInviteErr(message);
    } finally {
      setInviteBusy(false);
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

      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as ChangePasswordResponse;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to change password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordOpen(false);
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
        <div
          className="text-2xl font-semibold"
          style={{
            color: "#ecfeff",
            textShadow:
              "0 0 6px rgba(34,211,238,0.85), 0 0 14px rgba(59,130,246,0.55), 0 0 24px rgba(217,70,239,0.35)",
          }}
        >
          Super Admin Profile
        </div>
        <p className="mt-2 text-white/60">
          View superadmin account information, invitation code, and password controls.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        {loading ? <div className="text-white/60">Loading...</div> : null}
        {err ? <div className="text-red-400">{err}</div> : null}

        {!loading && !err && profile ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs uppercase tracking-[0.08em] text-white/50">Username</div>
              <div className="mt-2 text-lg font-semibold">{profile.username || "-"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs uppercase tracking-[0.08em] text-white/50">Role</div>
              <div className="mt-2 text-lg font-semibold uppercase">{profile.role || "-"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs uppercase tracking-[0.08em] text-white/50">Admin ID</div>
              <div className="mt-2 break-all font-mono text-sm text-white/85">{profile.id}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs uppercase tracking-[0.08em] text-white/50">Managed Users</div>
              <div className="mt-2 text-lg font-semibold">{profile.managedUsersCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:col-span-2">
              <div className="text-xs uppercase tracking-[0.08em] text-white/50">Created Date</div>
              <div className="mt-2 text-lg font-semibold">{fmtDate(profile.createdAt)}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-lg font-semibold">Invitation Code</div>
        <p className="mt-2 text-sm text-white/60">
          This code can be used for assignment and account workflows.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-lg tracking-wide">
            {profile?.invitationCode || "-"}
          </div>
          <button
            type="button"
            disabled={inviteBusy || loading || !profile}
            onClick={() => void regenerateInviteCode()}
            className="rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60"
          >
            {inviteBusy ? "Updating..." : "Regenerate Code"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm"
          >
            Refresh
          </button>
        </div>

        {inviteErr ? <div className="mt-3 text-sm text-red-400">{inviteErr}</div> : null}
        {inviteInfo ? <div className="mt-3 text-sm text-emerald-300">{inviteInfo}</div> : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Security</div>
            <p className="mt-2 text-sm text-white/60">
              Move your password update workflow here from Manage Subadmin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPasswordOpen((prev) => !prev)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {passwordOpen ? "Cancel" : "Change Password"}
          </button>
        </div>

        {passwordOpen ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
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

            <button
              type="button"
              onClick={() => void changeMyPassword()}
              disabled={
                changingPassword ||
                !currentPassword ||
                newPassword.length < 8 ||
                confirmNewPassword.length < 8
              }
              className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {changingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        ) : null}

        {changePasswordErr ? <div className="mt-3 text-sm text-red-400">{changePasswordErr}</div> : null}
        {changePasswordInfo ? (
          <div className="mt-3 text-sm text-emerald-300">{changePasswordInfo}</div>
        ) : null}
      </div>
    </div>
  );
}
