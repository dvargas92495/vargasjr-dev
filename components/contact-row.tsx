"use client";

import type { Contact } from "@/db/schema";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

const ContactRow = ({ contact }: { contact: Contact }) => {
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
      <td className="px-6 py-4 border-b">{contact.fullName || 'N/A'}</td>
      <td className="px-6 py-4 border-b">{contact.email || 'N/A'}</td>
      <td className="px-6 py-4 border-b">{contact.phoneNumber || 'N/A'}</td>
      <td className="px-6 py-4 border-b">
        {contact.createdAt.toLocaleDateString()}
      </td>
    </tr>
  );
};

export default ContactRow;
