"use client";

import { useEffect, useMemo, useState } from "react";
import TradeOrders from "./TradeOrders";
import { useTradeAction, type Side } from "./useTradeAction";

type LeverageTier = {
  id: string;
  label: string;
  pct: number; // leverage percent
};

const TIERS: LeverageTier[] = [
  { id: "t1", label: "$0 - $5,000", pct: 30 },
  { id: "t2", label: "$5,000 - $10,000", pct: 40 },
  { id: "t3", label: "$10,000 - $30,000", pct: 60 },
  { id: "t4", label: "$30,000 - $50,000", pct: 80 },
  { id: "t5", label: "$100,000 - Unlimited", pct: 120 },
];

export default function TradePanel() {
  const { balance, orders, pnl, place } = useTradeAction();
  const [side, setSide] = useState<Side>("BUY");
  const [price, setPrice] = useState("100");
  const [tierId, setTierId] = useState<string>(TIERS[0].id);

  // Premium-feel micro animation for PnL changes (C)
  const [pnlFlash, setPnlFlash] = useState<"up" | "down" | null>(null);
  const lastPnl = useMemo(() => pnl, [pnl]);

  const tier = useMemo(() => TIERS.find((t) => t.id === tierId) ?? TIERS[0], [tierId]);

  useEffect(() => {
    // flash when pnl changes
    setPnlFlash((prev) => {
      // if pnl is 0 or unchanged, no flash
      return pnl > 0 ? "up" : pnl < 0 ? "down" : null;
    });
    if (pnl !== 0) {
      const t = window.setTimeout(() => setPnlFlash(null), 550);
      return () => window.clearTimeout(t);
    }
  }, [lastPnl, pnl]);

  const pnlColor = pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-rose-400" : "text-gray-300";

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm text-gray-300">
        <span>Balance</span>
        <b className="text-white">${balance.toLocaleString()}</b>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["BUY", "SELL"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={
              "py-3 rounded-xl font-bold transition active:scale-[0.99] " +
              (side === s
                ? s === "BUY"
                  ? "bg-emerald-600 text-white shadow-[0_10px_30px_rgba(16,185,129,.25)]"
                  : "bg-rose-600 text-white shadow-[0_10px_30px_rgba(244,63,94,.22)]"
                : "bg-neutral-900 text-gray-300 border border-neutral-800 hover:border-neutral-700")
            }
          >
            {s}
          </button>
        ))}
      </div>

      {/* A: Leverage tier dropdown (user prefers dropdown) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-300">Enter quantity</span>
          <span
            className={
              "text-xs px-2 py-1 rounded-full border border-neutral-800 bg-neutral-900/60 " +
              (pnlFlash === "up"
                ? "ring-2 ring-emerald-500/30"
                : pnlFlash === "down"
                ? "ring-2 ring-rose-500/30"
                : "")
            }
          >
            <span className="text-gray-400">Applied leverage:</span>{" "}
            <b className="text-white">{tier.pct}%</b>
          </span>
        </div>

        <div className="relative">
          <select
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            className="w-full appearance-none p-3 pr-10 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} ({t.pct}%)
              </option>
            ))}
          </select>

          {/* chevron */}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            fill="none"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-gray-300">Fill Price (MVP manual)</span>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          className="w-full p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          placeholder="100"
        />
      </div>

      <button
        onClick={() => place(side, 1, Number(price))}
        className="w-full py-3 rounded-xl bg-blue-600 font-bold text-white transition hover:bg-blue-500 active:scale-[0.99] shadow-[0_16px_45px_rgba(37,99,235,.25)]"
      >
        Place Order
      </button>

      {/* C: Show PnL summary above tabs/orders */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-300">PnL</span>
        <span className={
          "font-bold tabular-nums " +
          pnlColor +
          (pnlFlash === "up" ? " animate-pulse" : pnlFlash === "down" ? " animate-pulse" : "")
        }>
          {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
        </span>
      </div>

      <TradeOrders orders={orders} pnl={pnl} />
    </div>
  );
}