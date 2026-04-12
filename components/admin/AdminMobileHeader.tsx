"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Link from "next/link";

export default function AdminMobileHeader({ adminName }: { adminName: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <header className="lg:hidden fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl border-b border-[#eceef0] h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 active:scale-95 transition-all text-[#15157d]"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <Link href="/admin" className="font-black text-[#15157d] text-lg tracking-tight font-headline">
            Admin
          </Link>
        </div>
        
        <div className="w-8 h-8 rounded-full bg-[#15157d]/10 flex items-center justify-center border border-[#15157d]/10">
          <span className="material-symbols-outlined text-base text-[#15157d]">person</span>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div className={`lg:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out transform w-64 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar adminName={adminName} isMobile onClose={() => setIsOpen(false)} />
      </div>
    </>
  );
}
