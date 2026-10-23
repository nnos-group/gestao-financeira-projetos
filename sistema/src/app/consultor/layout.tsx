"use client";

import React from "react";
import { ConsultorProvider } from "@/contexts/ConsultorContext";
import SidebarConsultor from "@/components/SidebarConsultor";

export default function ConsultorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsultorProvider>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="flex flex-col" style={{ height: "100%" }}>
            <SidebarConsultor />
          </div>
        </aside>

        <div className="main-wrapper">
          {children}
        </div>
      </div>
    </ConsultorProvider>
  );
}
