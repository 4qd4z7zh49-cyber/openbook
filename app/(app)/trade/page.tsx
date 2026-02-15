'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import TradeTabs from '@components/trade/TradeTabs';
import TradeChart from '@components/trade/TradeChart';
import TradePanel from '@components/trade/TradePanel';

const HERO_LINES = ['AI Trade', 'Your profit within seconds'];

export default function TradePage() {
  const [tab, setTab] = useState<'chart' | 'trade'>('trade');
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroVisible, setHeroVisible] = useState(true);

  useEffect(() => {
    let fadeTimer = 0;
    const rotate = window.setInterval(() => {
      setHeroVisible(false);
      fadeTimer = window.setTimeout(() => {
        setHeroIdx((prev) => (prev + 1) % HERO_LINES.length);
        setHeroVisible(true);
      }, 260);
    }, 2200);

    return () => {
      window.clearInterval(rotate);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-3 px-3 pb-2 pt-4 text-white sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1
          className={[
            'min-h-[2rem] text-2xl font-bold transition-opacity duration-300',
            heroVisible ? 'opacity-100' : 'opacity-10',
          ].join(' ')}
        >
          {HERO_LINES[heroIdx]}
        </h1>
        <Link
          href="/wallet#exchange"
          className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
        >
          Exchange in Wallet
        </Link>
      </div>

      <TradeTabs tab={tab} setTab={setTab} />

      {tab === 'chart' ? (
        <TradeChart symbol="BITSTAMP:BTCUSD" />
      ) : (
        <TradePanel />
      )}
    </div>
  );
}
