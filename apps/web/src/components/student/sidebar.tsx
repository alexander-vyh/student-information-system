"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  GraduationCap,
  FileText,
  DollarSign,
  User,
} from "lucide-react";

const navigation = [
  {
    name: "Dashboard",
    href: "/home",
    icon: LayoutDashboard,
  },
  {
    name: "My Classes",
    href: "/my-classes",
    icon: BookOpen,
  },
  {
    name: "Registration",
    href: "/registration",
    icon: ClipboardList,
  },
  {
    name: "Grades",
    href: "/grades",
    icon: GraduationCap,
  },
  {
    name: "Transcripts",
    href: "/transcripts",
    icon: FileText,
  },
  {
    name: "Financial",
    href: "/financial",
    icon: DollarSign,
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
  },
];

export function StudentSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-blue-900">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-bold text-white">Student Portal</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
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
                    ? "bg-blue-800 text-white"
                    : "text-blue-100 hover:bg-blue-800 hover:text-white"
                }
              `}
            >
              <Icon
                className={`mr-3 h-5 w-5 flex-shrink-0 ${
                  isActive ? "text-white" : "text-blue-300 group-hover:text-white"
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-blue-800 p-4">
        <p className="text-xs text-blue-300">
          Student Portal
          <br />
          v1.0.0
        </p>
      </div>
    </div>
  );
}
