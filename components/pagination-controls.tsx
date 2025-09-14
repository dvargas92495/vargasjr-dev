"use client";

import React from "react";
import Link from "next/link";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  searchParams?: Record<string, string>;
}

const PaginationControls = ({
  currentPage,
  totalPages,
  baseUrl,
  searchParams = {},
}: PaginationControlsProps) => {
  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    if (page > 1) {
      params.set("page", page.toString());
    } else {
      params.delete("page");
    }
    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={createPageUrl(currentPage - 1)}
        className={`px-3 py-1 text-sm rounded ${
          currentPage <= 1
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-gray-500 text-white hover:bg-gray-600"
        }`}
        {...(currentPage <= 1 && { "aria-disabled": true })}
      >
        Previous
      </Link>
      <span className="text-sm text-gray-600">
        Page {currentPage} of {totalPages}
      </span>
      <Link
        href={createPageUrl(currentPage + 1)}
        className={`px-3 py-1 text-sm rounded ${
          currentPage >= totalPages
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-gray-500 text-white hover:bg-gray-600"
        }`}
        {...(currentPage >= totalPages && { "aria-disabled": true })}
      >
        Next
      </Link>
    </div>
  );
};

export default PaginationControls;
