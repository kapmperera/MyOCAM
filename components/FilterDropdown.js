"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export default function FilterDropdown({ paramName = "filter", defaultLabel = "All", options = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleFilter = (value) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "All") {
      params.set(paramName, value);
    } else {
      params.delete(paramName);
    }
    
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <select
      defaultValue={searchParams.get(paramName)?.toString() || "All"}
      onChange={(e) => handleFilter(e.target.value)}
      style={{
        padding: "10px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(0,0,0,0.2)",
        color: "white",
        outline: "none",
        fontSize: "14px",
        cursor: "pointer"
      }}
    >
      <option value="All">{defaultLabel}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
