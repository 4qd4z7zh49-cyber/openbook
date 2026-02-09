// app/(app)/home/page.tsx
import HomeBanner from "@components/HomeBanner";
import FeatureGrid from "@components/FeatureGrid";
import TradingViewTape from "@components/TradingViewTape";

export default function HomePage() {
  return (
    <div className="homeWrap">
      <HomeBanner />
      <TradingViewTape />
      <FeatureGrid />
      <div className="homeBottomSpace" />
    </div>
  );
}