"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  BookOpen,
  Calendar,
  CalendarDays,
  AlertCircle,
  ShieldAlert,
  Clock,
  BarChart3,
  FileSpreadsheet,
  LayoutDashboard,
  ClipboardList,
  GraduationCap,
  Scale,
  FileText,
  Award,
  ArrowRightLeft,
} from "lucide-react";

const navigation = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    name: "Students",
    href: "/admin/students",
    icon: Users,
  },
  {
    name: "Registration",
    href: "/admin/registration",
    icon: ClipboardList,
  },
  {
    name: "Reg Control",
    href: "/admin/registration-control",
    icon: Clock,
  },
  {
    name: "Enrollments",
    href: "/admin/enrollments",
    icon: BookOpen,
  },
  {
    name: "Transfers",
    href: "/admin/transfer-credits",
    icon: ArrowRightLeft,
  },
  {
    name: "Sections",
    href: "/admin/sections",
    icon: Calendar,
  },
  {
    name: "Terms",
    href: "/admin/terms",
    icon: CalendarDays,
  },
  {
    name: "Holds",
    href: "/admin/holds",
    icon: AlertCircle,
  },
  {
    name: "Hold Types",
    href: "/admin/hold-types",
    icon: ShieldAlert,
  },
  {
    name: "Census",
    href: "/admin/census",
    icon: FileSpreadsheet,
  },
  {
    name: "Degree Audit",
    href: "/admin/degree-audit",
    icon: GraduationCap,
  },
  {
    name: "Ac. Standing",
    href: "/admin/academic-standing",
    icon: Scale,
  },
  {
    name: "Transcripts",
    href: "/admin/transcripts",
    icon: FileText,
  },
  {
    name: "Graduation",
    href: "/admin/graduation",
    icon: Award,
  },
  {
    name: "Reports",
    href: "/admin/reports",
    icon: BarChart3,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-bold text-white">SIS Admin</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          // Check if this route or any child route is active
          const isActive =
            item.href === "/admin"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center rounded-md px-3 py-2 text-sm font-medium
                transition-colors duration-150
                ${
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }
              `}
            >
              <Icon
                className={`mr-3 h-5 w-5 flex-shrink-0 ${
                  isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-800 p-4">
        <p className="text-xs text-gray-400">
          Student Information System
          <br />
          v1.0.0
        </p>
      </div>
    </div>
  );
}
