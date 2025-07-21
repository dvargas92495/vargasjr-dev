import React from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface SimulatorLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function SimulatorLayout({ title, description, children }: SimulatorLayoutProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/simulator">
          <button className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold mb-2">{title}</h1>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg">
        <div className="bg-gray-500 px-6 py-3 rounded-t-lg">
          <h2 className="text-lg font-semibold text-white">Preview Environment</h2>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
