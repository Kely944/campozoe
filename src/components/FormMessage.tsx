import type { FormState } from "@/app/actions";

/** Mensaje de error o de confirmación de un formulario; lo anuncian los lectores de pantalla. */
export default function FormMessage({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-800 dark:bg-red-950/40 dark:text-red-300">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-green-800 dark:bg-green-950/40 dark:text-green-300">
        {state.ok}
      </p>
    );
  return null;
}
