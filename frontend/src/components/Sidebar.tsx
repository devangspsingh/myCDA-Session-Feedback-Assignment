"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    roles: ["admin", "instructor", "parent", "student"],
  },
  {
    label: "Session Feedback",
    href: "/dashboard#feedback",
    roles: ["admin", "instructor", "parent", "student"],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(user.role)
  );

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <span className="text-lg font-semibold text-cda-navy">myCDA</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {visibleItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-cda-navy/10 text-cda-navy"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-gray-200 px-4 py-3">
        <p className="text-sm font-medium text-gray-900">
          {user.display_name}
        </p>
        <p className="text-xs text-gray-500 capitalize">{user.role}</p>
        <button
          onClick={logout}
          className="mt-2 text-xs text-gray-400 hover:text-red-600 cursor-pointer"
        >
          Sign out
        </button>
      </div>

      {/* Candidate / Author Profile */}
      <div className="border-t border-gray-200 bg-red-200/80 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
            Candidate
          </span>
          <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
            Author
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold text-gray-900 truncate" title="Devang Shaurya Pratap Singh">
          Devang S. P. Singh
        </p>

        <div className="mt-2 space-y-1 text-xs">
          <a
            href="mailto:devangshauryapratapsingh@gmail.com"
            className="group flex items-center gap-1.5 rounded py-1 text-gray-600 hover:text-gray-900 transition-colors"
            title="devangshauryapratapsingh@gmail.com"
          >
            <svg
              className="h-3.5 w-3.5 text-red-500 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
            <span className="truncate text-[11px]">
              Gmail
            </span>
          </a>

          <a
            href="https://www.linkedin.com/in/devangspsingh"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 rounded py-1 text-gray-600 hover:text-blue-700 transition-colors"
            title="LinkedIn Profile"
          >
            <svg
              className="h-3.5 w-3.5 text-blue-600 shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
            <span className="truncate text-[11px]">
              LinkedIn
            </span>
          </a>
        </div>
      </div>
    </aside>
  );
}

