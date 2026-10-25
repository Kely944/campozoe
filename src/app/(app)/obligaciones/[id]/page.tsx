import { notFound, redirect } from "next/navigation";
import { deleteObligation, saveObligation } from "@/app/actions";
import ObligationForm from "@/components/ObligationForm";
import { requireProfile } from "@/lib/session";
import { formatLocalInput } from "@/lib/time";
import type { Obligation } from "@/lib/types";

export default async function EditObligationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isAdmin } = await requireProfile();
  if (!isAdmin) redirect("/obligaciones");

  const [{ data: obligation }, { data: people }] = await Promise.all([
    supabase.from("obligations").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  if (!obligation) notFound();
  const o = obligation as Obligation;

  return (
    <main>
      <h1 className="mb-4 text-2xl font-bold">Editar tarea</h1>
      <ObligationForm
        action={saveObligation.bind(null, id)}
        obligation={o}
        dueLocal={o.due_at ? formatLocalInput(new Date(o.due_at)) : undefined}
        people={people ?? []}
      />
      <form action={deleteObligation.bind(null, id)} className="mt-8">
        <button className="btn-secondary w-full text-red-700">Eliminar tarea</button>
      </form>
    </main>
  );
}
