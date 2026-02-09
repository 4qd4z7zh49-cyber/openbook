"use client";

import { useEffect, useRef } from "react";

export default function TradingViewTape() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // cleanup + prevent duplicate
    el.innerHTML = "";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;

    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "BITSTAMP:BTCUSD", title: "BTC" },
        { proName: "BITSTAMP:ETHUSD", title: "ETH" },
        { proName: "OANDA:XAUUSD", title: "Gold" },
        { proName: "OANDA:XAGUSD", title: "Silver" },
        { proName: "NASDAQ:AAPL", title: "AAPL" },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "dark",
      locale: "en",
    });

    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, []);

  return (
    <div className="tvTapeWrap">
      <div className="tvTapeInner" ref={containerRef} />
    </div>
  );
}