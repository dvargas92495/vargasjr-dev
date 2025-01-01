"use client";

import { useSearchParams } from "next/navigation";

const SearchParamError = () => {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return <p className="text-red-500">{error}</p>;
};

export default SearchParamError;
