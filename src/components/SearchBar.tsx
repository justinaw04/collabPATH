// src/components/SearchBar.tsx
import { useEffect, useState } from "react";
import type { LatLng } from "../state/types.ts";

type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
};

type Props = {
  onSelect: (center: LatLng) => void;
  onRecenter: () => void;
};

export function SearchBar({ onSelect, onRecenter }: Props) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const debouncedQ = useDebounce(q, 250);

  useEffect(() => {
    let cancelled = false;

    async function fetchSuggestions() {
      if (!debouncedQ.trim()) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(debouncedQ)}`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        const data = (await res.json()) as Suggestion[];
        if (!cancelled) {
          setSuggestions(data || []);
          setOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  function choose(s: Suggestion) {
    const p = { lat: parseFloat(s.lat), lng: parseFloat(s.lon) };
    onSelect(p);
    setQ("");          // clear after selection
    setOpen(false);
    setSuggestions([]);
  }

  async function submitFirst(e: React.FormEvent) {
    e.preventDefault();
    if (suggestions[0]) {
      choose(suggestions[0]);
      return;
    }
    if (!q.trim()) return;
    const url =
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    const data = (await res.json()) as Suggestion[];
    if (data?.[0]) choose(data[0]);
  }

  return (
    <div className="absolute top-4 left-4 z-20 w-[22rem] md:w-[28rem]">
      <form
        onSubmit={submitFirst}
        className="flex items-center gap-2 bg-white/95 rounded-full shadow-md px-3 py-2"
      >
        <input
          className="flex-1 outline-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400"
          placeholder="Search Address"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
        />

        <button
          type="submit"
          className="px-3 py-1.5 text-sm font-semibold rounded-md bg-gray-100 hover:bg-gray-200"
        >
          {loading ? "..." : "Search"}
        </button>

        <button
          type="button"
          onClick={onRecenter}
          title="Back to my location"
          className="ml-1 w-9 h-9 grid place-items-center rounded-full bg-red-500 hover:bg-red-600 text-white font-bold shadow"
        >
          ⦿
        </button>
      </form>

      {open && suggestions.length > 0 && (
        <div className="mt-2 bg-white rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => choose(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
            >
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useDebounce<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
