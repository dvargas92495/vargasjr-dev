"use client";

import React from "react";
import Link from "next/link";
import { useState } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen max-h-screen">
      {/* Mobile sidebar overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex w-full max-w-xs flex-col bg-gray-500 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Menu</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-300 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <nav>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/admin"
                  className="block p-3 hover:bg-gray-200 hover:text-black rounded text-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/inboxes"
                  className="block p-3 hover:bg-gray-200 hover:text-black rounded text-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  Inboxes
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/applications"
                  className="block p-3 hover:bg-gray-200 hover:text-black rounded text-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  Applications
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/crm"
                  className="block p-3 hover:bg-gray-200 hover:text-black rounded text-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  CRM
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/jobs"
                  className="block p-3 hover:bg-gray-200 hover:text-black rounded text-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/simulator"
                  className="block p-3 hover:bg-gray-200 hover:text-black rounded text-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  Simulator
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 bg-gray-500 p-4">
        <nav>
          <ul className="space-y-2">
            <li>
              <Link
                href="/admin"
                className="block p-2 hover:bg-gray-200 hover:text-black rounded"
              >
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/admin/inboxes"
                className="block p-2 hover:bg-gray-200 hover:text-black rounded"
              >
                Inboxes
              </Link>
            </li>
            <li>
              <Link
                href="/admin/applications"
                className="block p-2 hover:bg-gray-200 hover:text-black rounded"
              >
                Applications
              </Link>
            </li>
            <li>
              <Link
                href="/admin/crm"
                className="block p-2 hover:bg-gray-200 hover:text-black rounded"
              >
                CRM
              </Link>
            </li>
            <li>
              <Link
                href="/admin/jobs"
                className="block p-2 hover:bg-gray-200 hover:text-black rounded"
              >
                Jobs
              </Link>
            </li>
            <li>
              <Link
                href="/admin/simulator"
                className="block p-2 hover:bg-gray-200 hover:text-black rounded"
              >
                Simulator
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 lg:p-8 flex flex-col">
        {/* Mobile header with hamburger menu */}
        <div className="lg:hidden flex items-center justify-between mb-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
        </div>
        
        {/* Desktop header */}
        <h1 className="hidden lg:block text-2xl font-bold mb-6">Admin Dashboard</h1>
        
        <div className="lg:overflow-x-auto flex flex-col flex-1">{children}</div>
      </div>
    </div>
  );
}
