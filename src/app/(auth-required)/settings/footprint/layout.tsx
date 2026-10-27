"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
const navItems = [
 { href: "/settings/footprint", label: "Tổng quan", exact: true },
 { href: "/settings/footprint/market-data", label: "Market Data" },
 { href: "/settings/footprint/engine", label: "Engine" },
 { href: "/settings/footprint/order-flow", label: "Order Flow" },
 { href: "/settings/footprint/volume-profile", label: "Volume Profile" },
 { href: "/settings/footprint/trades", label: "Trades" },
 { href: "/settings/footprint/database", label: "Database" },
 { href: "/settings/footprint/data-sync", label: "Data Sync" },
 { href: "/settings/footprint/system-health", label: "System Health" },
 { href: "/settings/footprint/validation", label: "Validation" },
 { href: "/settings/footprint/recovery", label: "Recovery" },
 { href: "/settings/footprint/retention", label: "Retention" },
];
export default function FootprintAdminLayout({ children }: { children: ReactNode }) {
 const pathname = usePathname();
 return <div className="min-h-full bg-slate-950 text-slate-100"><div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8"><header className="mb-6 border-b border-white/10 pb-5"><p className="text-xs font-bold uppercase tracking-[.24em] text-cyan-400">LHP-FI / SETTINGS</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Footprint Control Center</h1><p className="mt-1 text-sm text-slate-400">Quản trị dữ liệu giao dịch, Order Flow và chất lượng dữ liệu.</p></header><nav aria-label="Footprint administration" className="mb-7 flex gap-2 overflow-x-auto pb-2">{navItems.map(item => { const active = item.exact ? pathname === item.href : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`whitespace-nowrap rounded-lg border px-4 py-2 text-sm transition ${active ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-slate-800 bg-slate-900 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300"}`}>{item.label}</Link>; })}</nav>{children}</div></div>;
}
