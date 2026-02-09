// components/trade/TradeTabs.tsx
'use client';

export default function TradeTabs({
  tab,
  setTab,
}: {
  tab: 'chart' | 'trade';
  setTab: (v: 'chart' | 'trade') => void;
}) {
  return (
    <div className="flex gap-2 mb-3">
      {['chart', 'trade'].map((t) => (
        <button
          key={t}
          onClick={() => setTab(t as any)}
          className={`flex-1 py-3 rounded-full font-bold ${
            tab === t
              ? 'bg-slate-700 text-white'
              : 'bg-black border border-neutral-800 text-gray-400'
          }`}
        >
          {t === 'chart' ? 'Chart' : 'Trade'}
        </button>
      ))}
    </div>
  );
}