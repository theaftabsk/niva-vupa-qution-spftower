"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  LayoutDashboard,
  UserCheck,
  FileText,
  BookOpen,
  Mail,
  Activity,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  Building2,
  ShieldCheck,
  Briefcase,
  Archive,
  Terminal,
  RotateCcw,
  Coins,
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [userName, setUserName] = useState<string>("HR Administrator");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("banca_admin_token");
    const userStr = localStorage.getItem("banca_admin_user");

    if (!token && pathname !== "/admin/login") {
      setIsAuthenticated(false);
      router.push("/admin/login");
    } else {
      setIsAuthenticated(true);
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          setUserRole(u.role || "ADMIN");
          setUserName(u.name || "HR Administrator");
        } catch (e) {
          // ignore json parse error
        }
      }
    }
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem("banca_admin_token");
    localStorage.removeItem("banca_admin_user");
    setIsAuthenticated(false);
    router.push("/admin/login");
  };

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-semibold text-xs text-slate-700">Verifying Session...</p>
        </div>
      </div>
    );
  }

  // Navigation Items according to User Role
  const isVendor = userRole === "VENDOR";

  const navItems = isVendor
    ? [
        {
          href: "/admin",
          label: "My Dashboard",
          icon: LayoutDashboard,
        },
        {
          href: "/admin/assessments",
          label: "My Assessments",
          icon: FileText,
        },
        {
          href: "/admin/candidates",
          label: "My Candidates",
          icon: UserCheck,
        },
        {
          href: "/admin/emails",
          label: "Email Invitations",
          icon: Mail,
        },
      ]
    : [
        {
          href: "/admin",
          label: "Dashboard Overview",
          icon: LayoutDashboard,
        },
        {
          href: "/admin/assessments",
          label: "Exams & Assessments",
          icon: FileText,
        },
        {
          href: "/admin/candidates",
          label: "Candidate Evaluation",
          icon: UserCheck,
        },
        {
          href: "/admin/vendors",
          label: "Vendors Management",
          icon: Building2,
        },
        {
          href: "/admin/api-logs",
          label: "Vendor API Logs",
          icon: Terminal,
        },
        {
          href: "/admin/candidate-logs",
          label: "Candidate Lifecycle Logs",
          icon: RotateCcw,
        },
        {
          href: "/admin/logs",
          label: "Exam Credits History",
          icon: Coins,
        },
        {
          href: "/admin/emails",
          label: "Email Audit & Invites",
          icon: Mail,
        },
        {
          href: "/admin/questions",
          label: "Question Bank CMS",
          icon: BookOpen,
        },
        {
          href: "/admin/archive",
          label: "Archive & Bin",
          icon: Archive,
        },
        {
          href: "/admin/settings",
          label: "System Settings",
          icon: SettingsIcon,
        },
      ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* Fixed Header Navbar */}
      <Navbar
        onMobileSidebarToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      <div className="flex-1 flex w-full relative">
        {/* Mobile Sidebar Backdrop */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          ></div>
        )}

        {/* Dedicated Fixed Left Sidebar */}
        <aside
          className={`fixed top-16 left-0 bottom-0 z-40 bg-white border-r border-slate-200 flex flex-col justify-between overflow-y-auto shrink-0 transform transition-all duration-300 ${
            isCollapsed ? "lg:w-20 w-64" : "w-64"
          } ${mobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}`}
        >
          <div className={isCollapsed ? "p-2.5 space-y-2" : "p-4 space-y-3"}>
            {/* User Role Badge */}
            {!isCollapsed && (
              <div
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  isVendor
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-blue-50 border-blue-200 text-blue-900"
                }`}
              >
                {isVendor ? <Briefcase size={16} className="text-amber-600 shrink-0" /> : <ShieldCheck size={16} className="text-blue-600 shrink-0" />}
                <div className="overflow-hidden">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    {isVendor ? "Vendor Account" : "HR Administrator"}
                  </p>
                  <p className="text-xs font-black truncate">{userName}</p>
                </div>
              </div>
            )}

            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between ${
                      isCollapsed ? "p-3 justify-center" : "p-3"
                    } ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                      {!isCollapsed && <span>{item.label}</span>}
                    </div>
                    {!isCollapsed && isActive && <ChevronRight className="w-4 h-4 text-white shrink-0" />}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Sign Out Button */}
          <div className={isCollapsed ? "p-2.5 border-t border-slate-100" : "p-4 border-t border-slate-100"}>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className={`w-full border border-slate-200 bg-slate-50 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer ${
                isCollapsed ? "p-3 rounded-xl" : "p-2.5 rounded-xl"
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main
          className={`flex-1 pt-16 min-h-screen w-full transition-all duration-300 ${
            isCollapsed ? "lg:pl-20" : "lg:pl-64"
          }`}
        >
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
