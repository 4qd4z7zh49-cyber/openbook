"use client";

import { useEffect, useMemo, useState } from "react";

type UserRow = {
  id: string;
  username?: string | null;
  email?: string | null;
  managedBy?: string | null;
  managedByUsername?: string | null;
  createdAt?: string | null;
};

type SubadminRow = {
  id: string;
  username?: string | null;
};

type ManageUsersResponse = {
  ok?: boolean;
  error?: string;
  users?: UserRow[];
  subadmins?: SubadminRow[];
};

type ManageUsersUpdateResponse = {
  ok?: boolean;
  error?: string;
  user?: UserRow;
};

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function managerLabel(user: UserRow) {
  if (!user.managedBy) return "Unassigned";
  const name = String(user.managedByUsername || "").trim();
  if (name) return name;
  return `${user.managedBy.slice(0, 8)}...`;
}

function managerValue(user: UserRow) {
  return user.managedBy || "UNASSIGNED";
}

export default function ManageUserPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [subadmins, setSubadmins] = useState<SubadminRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [draftByUserId, setDraftByUserId] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/manage-users", {
        cache: "no-store",
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as ManageUsersResponse;
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to load manage users");

      const nextUsers = Array.isArray(j.users) ? j.users : [];
      const nextSubadmins = Array.isArray(j.subadmins) ? j.subadmins : [];

      setUsers(nextUsers);
      setSubadmins(nextSubadmins);

      const nextDraft: Record<string, string> = {};
      nextUsers.forEach((row) => {
        nextDraft[row.id] = managerValue(row);
      });
      setDraftByUserId(nextDraft);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load manage users";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const username = String(u.username || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      return username.includes(q) || email.includes(q);
    });
  }, [users, search]);

  const onChangeManager = (userId: string, value: string) => {
    setDraftByUserId((prev) => ({
      ...prev,
      [userId]: value,
    }));
  };

  const saveUserManager = async (user: UserRow) => {
    const selected = String(draftByUserId[user.id] || managerValue(user));
    if (selected === managerValue(user)) {
      setInfo("No changes to save.");
      setErr("");
      return;
    }

    setSavingUserId(user.id);
    setErr("");
    setInfo("");
    try {
      const r = await fetch("/api/admin/manage-users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          managedBy: selected === "UNASSIGNED" ? null : selected,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as ManageUsersUpdateResponse;
      if (!r.ok || !j?.ok || !j.user) {
        throw new Error(j?.error || "Failed to update manager");
      }

      setUsers((prev) => prev.map((row) => (row.id === user.id ? j.user || row : row)));
      setDraftByUserId((prev) => ({
        ...prev,
        [user.id]: managerValue(j.user || user),
      }));

      const who = user.username || user.email || "User";
      const target = j.user?.managedByUsername || (j.user?.managedBy ? "Sub-admin" : "Unassigned");
      setInfo(`${who} moved to ${target}.`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to update manager";
      setErr(message);
    } finally {
      setSavingUserId("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Manage User</div>
        <p className="mt-2 text-white/60">
          Move customer assignment between unassigned and sub-admin managers.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <input
            className="w-full max-w-sm rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            placeholder="Search username or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {err ? <div className="mb-3 text-sm text-red-400">{err}</div> : null}
        {info ? <div className="mb-3 text-sm text-emerald-300">{info}</div> : null}
        {loading ? <div className="text-white/60">Loading...</div> : null}

        {!loading && filteredUsers.length === 0 ? (
          <div className="text-white/60">No users found.</div>
        ) : null}

        {!loading && filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="text-left text-white/60">
                  <th className="py-3">USERNAME</th>
                  <th className="py-3">EMAIL</th>
                  <th className="py-3">CURRENT MANAGER</th>
                  <th className="py-3">MOVE TO</th>
                  <th className="py-3 text-right">ACTION</th>
                  <th className="py-3 text-right">CREATED</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const selected = String(draftByUserId[user.id] || managerValue(user));
                  const saving = savingUserId === user.id;

                  return (
                    <tr key={user.id} className="border-t border-white/10">
                      <td className="py-3">{user.username || "-"}</td>
                      <td className="py-3">{user.email || "-"}</td>
                      <td className="py-3">{managerLabel(user)}</td>
                      <td className="py-3">
                        <select
                          value={selected}
                          onChange={(e) => onChangeManager(user.id, e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                        >
                          <option value="UNASSIGNED" className="bg-black">
                            Unassigned
                          </option>
                          {subadmins.map((m) => (
                            <option key={m.id} value={m.id} className="bg-black">
                              {m.username || m.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveUserManager(user)}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                      </td>
                      <td className="py-3 text-right text-white/70">{fmtDate(user.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
