"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, Coins, AlertTriangle } from "lucide-react";

interface NavbarProps {
  onMobileSidebarToggle?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard Overview",
  "/admin/assessments": "Exams & Assessments",
  "/admin/candidates": "Candidate Evaluation",
  "/admin/logs": "Exam & Credit Logs",
  "/admin/emails": "Email Audit & Invites",
  "/admin/questions": "Question Bank CMS",
  "/admin/settings": "System Settings",
  "/admin/archive": "Archive & Recycle Bin",
};

export default function Navbar({ onMobileSidebarToggle, isCollapsed, onToggleCollapse }: NavbarProps) {
  const pathname = usePathname();
  const currentTitle = pageTitles[pathname] || "HR Admin Portal";

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="w-full h-full px-4 sm:px-6 flex items-center justify-between">
        
        {/* Left: Brand Logo, Mobile Menu, Desktop Collapse Toggle & Page Title */}
        <div className="flex items-center space-x-3">
          {/* Mobile Menu Button */}
          {onMobileSidebarToggle && (
            <button
              onClick={onMobileSidebarToggle}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Toggle Mobile Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Desktop Sidebar Collapse Toggle */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen className="w-5 h-5 text-blue-600" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          )}

          <Link href="/admin" className="flex items-center space-x-3">
            <Image
              src="/niva-bupa-logo.png"
              alt="Niva Bupa Health Insurance"
              width={210}
              height={191}
              style={{
                height: "40px",
                width: "auto",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0, 160, 230, 0.18)",
                objectFit: "contain"
              }}
              priority
            />
          </Link>
          
          <div className="hidden sm:flex border-l border-slate-200 pl-3">
            <span className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              {currentTitle}
            </span>
          </div>
        </div>

        {/* Right side placeholder or clean header */}
        <div className="flex items-center gap-3">
        </div>

      </div>
    </header>
  );
}
