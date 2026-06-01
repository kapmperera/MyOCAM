"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function CustomRangeFilter({ paramName = "range" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentRange = searchParams.get(paramName) || "All";
  const [initialMin, initialMax] = currentRange !== "All" ? currentRange.split("-") : ["", ""];

  const [min, setMin] = useState(initialMin);
  const [max, setMax] = useState(initialMax);

  const applyFilter = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    
    if (min === "" && max === "") {
      params.delete(paramName);
    } else {
      const minVal = min === "" ? "0" : min;
      const maxVal = max === "" ? "100" : max;
      params.set(paramName, `${minVal}-${maxVal}`);
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const clearFilter = () => {
    setMin("");
    setMax("");
    const params = new URLSearchParams(searchParams);
    params.delete(paramName);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <form 
      onSubmit={applyFilter} 
      style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "8px", 
        background: "rgba(0,0,0,0.2)", 
        padding: "4px 8px", 
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.1)"
      }}
    >
      <input
        type="number"
        placeholder="Min"
        value={min}
        onChange={(e) => setMin(e.target.value)}
        style={{
          width: "60px",
          padding: "6px",
          borderRadius: "4px",
          border: "none",
          background: "rgba(255,255,255,0.1)",
          color: "white",
          fontSize: "14px",
          outline: "none"
        }}
      />
      <span style={{ color: "var(--text-muted)" }}>-</span>
      <input
        type="number"
        placeholder="Max"
        value={max}
        onChange={(e) => setMax(e.target.value)}
        style={{
          width: "60px",
          padding: "6px",
          borderRadius: "4px",
          border: "none",
          background: "rgba(255,255,255,0.1)",
          color: "white",
          fontSize: "14px",
          outline: "none"
        }}
      />
      <button 
        type="submit" 
        style={{
          padding: "6px 12px",
          borderRadius: "4px",
          border: "none",
          background: "var(--accent-primary)",
          color: "white",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: "bold"
        }}
      >
        Apply
      </button>
      {(min !== "" || max !== "") && (
        <button 
          type="button"
          onClick={clearFilter}
          style={{
            padding: "6px 8px",
            borderRadius: "4px",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          Clear
        </button>
      )}
    </form>
  );
}
