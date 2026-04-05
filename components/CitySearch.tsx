"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  defaultQuery: string;
};

export default function CitySearch({ defaultQuery }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(defaultQuery);

  useEffect(() => {
    setValue(defaultQuery);
  }, [defaultQuery]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim() || "San Francisco, California, USA";
    router.push(`/?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-center"
    >
      <label className="sr-only" htmlFor="city-search">
        City or place
      </label>
      <input
        id="city-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Lahore, Pakistan · Paris · Austin, TX · Tokyo"
        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-600 focus:outline-none"
        autoComplete="off"
      />
      <button
        type="submit"
        className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-500"
      >
        Load area
      </button>
    </form>
  );
}
