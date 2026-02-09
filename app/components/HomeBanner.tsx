"use client";

import Link from "next/link";

export default function HomeBanner() {
  return (
    <section className="hbCard">
      {/* Top mini bar */}
      <div className="hbTopBar">
        <Link href="/settings" className="hbIconBtn" aria-label="Profile">
          {/* user icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 21a8 8 0 0 0-16 0"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <button className="hbIconBtn hbBell" aria-label="Notifications" type="button">
          {/* bell icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 17H9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* unread dot (optional) */}
          <span className="hbDot" />
        </button>
      </div>

      {/* Existing content */}
      <div className="hbText">
        <div className="hbSmall">Welcome back</div>
        <div className="hbTitle">OpenBook</div>

        <div className="hbBalanceRow">
          <div className="hbBalanceLabel">Total Balance</div>
          <div className="hbBalanceValue">$10,932.11</div>
        </div>

        <div className="hbActions">
  <button className="hbAction hbPrimary" type="button">Deposit</button>
  <button className="hbAction hbGhost" type="button">Withdraw</button>
  <button className="hbAction hbGhost" type="button">Trade</button>
</div>
      </div>
    </section>
  );
}