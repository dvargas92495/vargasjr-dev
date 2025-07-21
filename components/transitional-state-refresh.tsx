"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

const TransitionalStateRefresh = () => {
  const router = useRouter();
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [router]);
  return <></>;
};

export default TransitionalStateRefresh;
