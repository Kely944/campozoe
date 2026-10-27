"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { signIn } from "../actions";
import ThemeToggle from "@/components/ThemeToggle";
import MushroomLogo from "@/components/MushroomLogo";

const inputClass =
  "h-12 w-full rounded-lg border border-stone-300 bg-white pl-11 pr-4 text-base text-stone-900 placeholder:text-stone-500 transition-colors focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/20 dark:border-stone-700 dark:bg-stone-900 dark:text-white dark:placeholder:text-stone-400 dark:focus:border-green-500 dark:focus:ring-green-500/25";

const iconClass = "pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-500 dark:text-stone-400";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, {});
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [photoLoaded, setPhotoLoaded] = useState(false);

  return (
    <main className="min-h-svh bg-[#f7f7f4] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] dark:bg-[#111111]">
      <div className="fixed left-6 top-6 z-10 sm:left-10 sm:top-8">
        <ThemeToggle />
      </div>

      {/* Foto: cama de cultivo de champiñón. Arriba en el celular, a la derecha en pantallas grandes */}
      <figure className="relative h-[32vh] min-h-56 overflow-hidden bg-stone-900 lg:order-2 lg:sticky lg:top-0 lg:h-svh">
        <Image
          src="/login/cultivo-champinon.jpg"
          alt="Champiñones blancos creciendo en camas de cultivo"
          fill
          priority
          sizes="(min-width: 1024px) 54vw, 100vw"
          onLoad={() => setPhotoLoaded(true)}
          className={`object-cover object-[50%_70%] transition-opacity duration-500 ease-out dark:brightness-[0.8] ${photoLoaded ? "opacity-100" : "opacity-0"}`}
        />
      </figure>

      <section className="flex flex-col px-6 pb-8 pt-10 sm:px-10 lg:min-h-svh lg:pt-8">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center lg:py-16">
          <div className="mb-10 flex items-center gap-2.5 text-green-800 dark:text-green-500">
            <MushroomLogo className="size-8" />
            <span className="text-lg font-semibold tracking-tight text-stone-900 dark:text-white">Pendientes</span>
          </div>

          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-stone-900 dark:text-white">Inicia sesión</h1>
          <p className="mt-2 text-base text-stone-600 dark:text-stone-300">Pedidos, ofertas y pagos de la semana.</p>

          <form action={action} className="mt-8 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-stone-800 dark:text-stone-200" htmlFor="email">Correo</label>
              <div className="relative">
                <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                <input
                  className={inputClass}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-800 dark:text-stone-200" htmlFor="password">Contraseña</label>
              <div className="relative">
                <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <input
                  className={`${inputClass} pr-12`}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-green-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className={`absolute size-[18px] transition-[opacity,scale,filter] duration-150 ease-out motion-reduce:transition-opacity ${showPassword ? "scale-100 opacity-100 blur-0" : "scale-75 opacity-0 blur-[2px]"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 4.2A10.4 10.4 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6" />
                  </svg>
                  <svg viewBox="0 0 24 24" className={`absolute size-[18px] transition-[opacity,scale,filter] duration-150 ease-out motion-reduce:transition-opacity ${showPassword ? "scale-75 opacity-0 blur-[2px]" : "scale-100 opacity-100 blur-0"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>

            {state.error && (
              <p role="alert" className="flex translate-y-0 items-start opacity-100 transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0 gap-2.5 rounded-lg bg-[#ffedea] px-4 py-3 text-sm text-[#831c1e] dark:bg-[#2c1a20] dark:text-[#f08a9b]">
                <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                {state.error}
              </p>
            )}

            <button
              className="!mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-800 text-base font-semibold text-white transition-[scale,background-color] duration-150 ease-out hover:bg-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800 active:scale-[0.97] disabled:opacity-60 motion-reduce:active:scale-100 dark:bg-green-700 dark:hover:bg-green-600 dark:focus-visible:outline-green-500"
              disabled={pending}
            >
              {pending && (
                <svg viewBox="0 0 24 24" className="size-5 animate-spin" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-6 text-sm text-stone-600 dark:text-stone-400">¿No tienes cuenta? Pídela a la administradora.</p>
        </div>

        <p className="mx-auto mt-10 w-full max-w-sm text-xs text-stone-500 lg:mt-0 dark:text-stone-400">
          Foto: «IMG 0408 – Hungary – Mushroom Farm», Andrew Bossi,{" "}
          <a className="underline hover:text-stone-800 dark:hover:text-white" href="https://commons.wikimedia.org/w/index.php?curid=1440685" target="_blank" rel="noreferrer">
            CC BY-SA 2.5
          </a>
          , vía Wikimedia Commons.
        </p>
      </section>
    </main>
  );
}
