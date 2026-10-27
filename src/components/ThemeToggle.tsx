"use client";

import { flushSync } from "react-dom";
import { useEffect, useState } from "react";

// Cambia entre claro y oscuro. Guarda la elección en localStorage ("theme").
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  function apply(next: boolean) {
    const root = document.documentElement;
    root.classList.toggle("dark", next);
    setDark(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = !dark;
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!document.startViewTransition || reduce) {
      root.classList.add("theme-fade");
      apply(next);
      setTimeout(() => root.classList.remove("theme-fade"), 450);
      return;
    }

    // El círculo nace en el centro del botón y cubre toda la pantalla
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    root.style.setProperty("--theme-r", `${r}px`);
    document.startViewTransition(() => flushSync(() => apply(next)));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={dark ? "Modo claro" : "Modo oscuro"}
      className={`relative inline-flex size-11 items-center justify-center overflow-hidden rounded-full border border-stone-300 bg-white text-stone-700 transition-[scale,background-color] duration-150 ease-out hover:bg-stone-50 active:scale-[0.94] dark:border-stone-700 dark:bg-stone-900 dark:text-amber-300 dark:hover:bg-stone-800 ${className}`}
    >
      {/* Sol */}
      <svg
        viewBox="0 0 24 24"
        className={`absolute size-5 transition-[opacity,rotate,scale] duration-300 ease-out ${dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      {/* Luna */}
      <svg
        viewBox="0 0 24 24"
        className={`absolute size-5 transition-[opacity,rotate,scale] duration-300 ease-out ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}
