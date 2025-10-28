"use client";

import { useMemo } from "react";

type Props = {
  value: string | number | Date;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
};

export default function LocalTime({ value, options, className }: Props) {
  const date = useMemo(() => new Date(value), [value]);
  const text = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "short",
        timeStyle: "medium",
        ...options,
      }).format(date),
    [date, options]
  );

  return (
    <time dateTime={date.toISOString()} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
