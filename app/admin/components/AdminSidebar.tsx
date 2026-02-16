"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type DepositRequestBadgeResponse = {
  ok?: boolean;
  pendingCount?: number;
};

type ManagerRow = {
  id: string;
  username?: string | null;
  role?: string | null;
};

type ManagersResponse = {
  ok?: boolean;
  managers?: ManagerRow[];
};

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const tab = (sp.get("tab") || "overview").toLowerCase();
  const managedBy = String(sp.get("managedBy") || "ALL").trim() || "ALL";
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutErr, setLogoutErr] = useState("");
  const [pendingDepositCount, setPendingDepositCount] = useState(0);
  const [pendingWithdrawCount, setPendingWithdrawCount] = useState(0);
  const [pendingNotifyCount, setPendingNotifyCount] = useState(0);
  const [pendingSupportCount, setPendingSupportCount] = useState(0);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);

  const goTab = (t: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("tab", t);
    if (!managedBy || managedBy.toUpperCase() === "ALL") {
      params.delete("managedBy");
    } else {
      params.set("managedBy", managedBy);
    }
    router.push(`/admin?${params.toString()}`);
  };
  const goManageAdmin = () => router.push("/admin/manage-admin");
  const goManageUser = () => router.push("/admin/manage-user");

  const onChangeManagedBy = (value: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("tab", tab || "overview");
    if (!value || value.toUpperCase() === "ALL") {
      params.delete("managedBy");
    } else {
      params.set("managedBy", value);
    }
    router.push(`/admin?${params.toString()}`);
  };

  const onLogout = async () => {
    setLogoutLoading(true);
    setLogoutErr("");
    try {
      const r = await fetch("/api/admin/logout", {
        method: "POST",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.error || "Logout failed");
      }
      router.replace("/admin/login");
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Logout failed";
      setLogoutErr(message);
    } finally {
      setLogoutLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const managedByParams = new URLSearchParams();
        if (managedBy && managedBy.toUpperCase() !== "ALL") {
          managedByParams.set("managedBy", managedBy);
        }
        const managedByQuery = managedByParams.toString();
        const withManagedBy = (path: string) => {
          if (!managedByQuery) return path;
          return `${path}${path.includes("?") ? "&" : "?"}${managedByQuery}`;
        };

        const [depRes, wdRes, notifyRes, supportRes] = await Promise.all([
          fetch(withManagedBy("/api/admin/deposit-requests?status=PENDING&limit=1"), {
            cache: "no-store",
            credentials: "include",
          }),
          fetch(withManagedBy("/api/admin/withdraw-requests?status=PENDING&limit=1"), {
            cache: "no-store",
            credentials: "include",
          }),
          fetch(withManagedBy("/api/admin/notify?status=PENDING&limit=1"), {
            cache: "no-store",
            credentials: "include",
          }),
          fetch(withManagedBy("/api/admin/support?mode=badge"), {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const depJson = (await depRes.json().catch(() => ({}))) as DepositRequestBadgeResponse;
        const wdJson = (await wdRes.json().catch(() => ({}))) as DepositRequestBadgeResponse;
        const notifyJson = (await notifyRes.json().catch(() => ({}))) as DepositRequestBadgeResponse;
        const supportJson = (await supportRes.json().catch(() => ({}))) as DepositRequestBadgeResponse;

        if (!cancelled) {
          if (depRes.ok && depJson?.ok) setPendingDepositCount(Number(depJson.pendingCount ?? 0));
          if (wdRes.ok && wdJson?.ok) setPendingWithdrawCount(Number(wdJson.pendingCount ?? 0));
          if (notifyRes.ok && notifyJson?.ok) setPendingNotifyCount(Number(notifyJson.pendingCount ?? 0));
          if (supportRes.ok && supportJson?.ok) setPendingSupportCount(Number(supportJson.pendingCount ?? 0));
        }
      } catch {
        // ignore badge polling errors
      }
    };

    void run();
    const t = window.setInterval(() => {
      void run();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [managedBy]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setManagersLoading(true);
      try {
        const r = await fetch("/api/admin/managers", {
          cache: "no-store",
          credentials: "include",
        });
        const j = (await r.json().catch(() => ({}))) as ManagersResponse;
        if (!r.ok || !j?.ok) return;
        if (!cancelled) {
          setManagers(Array.isArray(j.managers) ? j.managers : []);
        }
      } finally {
        if (!cancelled) setManagersLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const item = (label: string, active: boolean, onClick: () => void, badgeCount?: number) => (
    <button
      onClick={onClick}
      className={`w-full rounded-xl px-4 py-3 text-left ${
        active ? "bg-white/10" : "bg-white/5 hover:bg-white/10"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {typeof badgeCount === "number" && badgeCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-xs font-semibold text-white">
            {badgeCount}
          </span>
        ) : null}
      </span>
    </button>
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="text-xl font-semibold">Admin</div>
      <label className="mt-1 block">
        <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-white/45">Managed By</div>
        <select
          value={managedBy}
          onChange={(e) => onChangeManagedBy(e.target.value)}
          disabled={managersLoading}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
        >
          <option value="ALL" className="bg-black">
            All users
          </option>
          <option value="UNASSIGNED" className="bg-black">
            Unassigned
          </option>
          {managers.map((m) => (
            <option key={m.id} value={m.id} className="bg-black">
              {m.username || m.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>

      {item("Overview", tab === "overview", () => goTab("overview"))}
      {item("User Control", tab === "users", () => goTab("users"))}
      {item("Deposit Permission", tab === "topups", () => goTab("topups"), pendingDepositCount)}
      {item("Mining Permission", tab === "mining", () => goTab("mining"))}
      {item("Trade Permission", tab === "orders", () => goTab("orders"))}
      {item("Withdraw Permission", tab === "withdraw", () => goTab("withdraw"), pendingWithdrawCount)}
      {item(
        "Mail Notify",
        tab === "notify",
        () => goTab("notify"),
        tab === "notify" ? 0 : pendingNotifyCount
      )}
      {item(
        "Customer Support",
        tab === "support",
        () => goTab("support"),
        tab === "support" ? 0 : pendingSupportCount
      )}

      <div className="mt-2 border-t border-white/10 pt-3">
        {item("Manage Admin", pathname === "/admin/manage-admin", goManageAdmin)}
        {item("Manage User", pathname === "/admin/manage-user", goManageUser)}
      </div>

      <div className="mt-auto border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={logoutLoading}
          className="w-full rounded-xl border border-rose-400/30 bg-rose-600/90 px-4 py-3 text-left font-semibold text-white disabled:opacity-60"
        >
          {logoutLoading ? "Logging out..." : "Log out"}
        </button>
        {logoutErr ? <div className="mt-2 text-xs text-red-300">{logoutErr}</div> : null}
      </div>
    </div>
  );
}
