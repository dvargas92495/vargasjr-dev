"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const PendingInstanceRefresh = () => {
  const router = useRouter();
  useEffect(() => {
    setTimeout(() => {
      router.refresh();
    }, 5000);
  }, [router]);
  return <></>;
};

export default PendingInstanceRefresh;
