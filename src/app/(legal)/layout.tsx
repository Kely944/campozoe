import Link from "next/link";
import MushroomLogo from "@/components/MushroomLogo";
import { CONTACTO } from "./contacto";

/** Páginas públicas (sin sesión): política de privacidad y términos. Meta las exige para publicar la app de WhatsApp. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-[#f7f7f4] px-6 py-10 sm:px-10 dark:bg-[#111111]">
      <article className="mx-auto max-w-2xl text-stone-700 dark:text-stone-300 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:text-stone-900 dark:[&_h1]:text-white [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-stone-900 dark:[&_h2]:text-white [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_a]:text-green-800 [&_a]:underline dark:[&_a]:text-green-400">
        <Link href="/login" className="mb-8 flex items-center gap-2.5 !text-green-800 !no-underline dark:!text-green-500">
          <MushroomLogo className="size-8" />
          <span className="text-lg font-semibold text-stone-900 dark:text-white">Pendientes</span>
        </Link>
        {children}
        <p className="!mt-12 border-t border-stone-200 pt-6 text-sm dark:border-stone-800">
          <Link href="/privacidad">Política de privacidad</Link> · <Link href="/terminos">Términos de uso</Link> ·{" "}
          <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>
        </p>
      </article>
    </main>
  );
}
