"use client";

import { useCallback } from "react";

const CopyableText = ({
  text,
  className,
}: {
  text: string;
  className: string;
}) => {
  const copyText = useCallback(() => {
    navigator.clipboard.writeText(text);
  }, [text]);

  return (
    <span
      className={`${className} hover:cursor-pointer hover:bg-gray-500 text-gray-900`}
      onClick={copyText}
    >
      {text}
    </span>
  );
};

export default CopyableText;
