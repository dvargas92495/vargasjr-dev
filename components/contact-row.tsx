"use client";

import type { Contact } from "@/db/schema";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

function formatDate(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return "N/A";
  try {
    const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    if (isNaN(date.getTime())) return "Invalid date";
    return date.toLocaleDateString();
  } catch {
    return "Invalid date";
  }
}

const ContactRow = ({
  contact,
}: {
  contact: Contact & { lastMessageAt: string | null };
}) => {
  const router = useRouter();
  const handleClick = useCallback(() => {
    router.push(`/admin/crm/${contact.id}`);
  }, [router, contact.id]);

  return (
    <tr
      key={contact.id}
      className="hover:bg-gray-50 hover:cursor-pointer hover:text-black"
      onClick={handleClick}
    >
      <td className="px-6 py-4 border-b">{contact.fullName || "N/A"}</td>
      <td className="px-6 py-4 border-b">{contact.email || "N/A"}</td>
      <td className="px-6 py-4 border-b">{contact.phoneNumber || "N/A"}</td>
      <td className="px-6 py-4 border-b">
        {formatDate(contact.lastMessageAt)}
      </td>
    </tr>
  );
};

export default ContactRow;
