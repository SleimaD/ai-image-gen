import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default function TabsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-screen bg-[#0b1220] text-white">
      
      <Sidebar />
     
      <main className="ml-0 flex-1 pt-16 md:pt-0 md:ml-[72px]">{children}</main>
    </div>
  );
}
