// app/(app)/layout.tsx
import type { ReactNode } from "react";
import BottomNav from "@/app/components/BottomNav";
import OneSignalBootstrap from "@/app/components/OneSignalBootstrap";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-black text-white">
      <OneSignalBootstrap />
      <main className="flex-1 overflow-x-hidden pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
