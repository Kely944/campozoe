import { redirect } from "next/navigation";
import { saveObligation } from "@/app/actions";
import ObligationForm from "@/components/ObligationForm";
import { requireProfile } from "@/lib/session";

export default async function NewObligationPage() {
  const { supabase, isAdmin } = await requireProfile();
  if (!isAdmin) redirect("/obligaciones");
  const { data: people } = await supabase.from("profiles").select("id, full_name").order("full_name");
  return (
    <main>
      <h1 className="mb-4 text-2xl font-bold">Nueva tarea</h1>
      <ObligationForm action={saveObligation.bind(null, null)} people={people ?? []} />
    </main>
  );
}
