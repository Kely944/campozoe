import { updateProfile } from "@/app/actions";
import ProfileForm from "@/components/ProfileForm";
import { requireProfile } from "@/lib/session";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { supabase, isAdmin } = await requireProfile();
  const { data: people } = await supabase.from("profiles").select("id, full_name, phone, role").order("full_name");

  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold">Equipo</h1>
      <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">
        Los avisos llegan al WhatsApp de cada persona. Para agregar a alguien, créale un usuario en Supabase (Authentication &gt; Users).
      </p>
      <div className="space-y-4">
        {((people ?? []) as Profile[]).map((p) => (
          <ProfileForm key={p.id} action={updateProfile.bind(null, p.id)} profile={p} editable={isAdmin} />
        ))}
      </div>
    </main>
  );
}
