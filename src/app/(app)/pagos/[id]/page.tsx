import { notFound } from "next/navigation";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { deletePayment, savePayment } from "../actions";
import PaymentForm from "@/components/PaymentForm";
import type { Payment } from "@/lib/pagos";
import { requireAdmin } from "@/lib/session";

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <main>
      <h1 className="mb-6 font-display text-3xl leading-tight font-semibold">Editar pago</h1>
      <PaymentForm action={savePayment.bind(null, id)} payment={data as Payment} />
      <form action={deletePayment.bind(null, id)} className="mt-8">
        <ConfirmSubmit label="Eliminar pago y su aviso" />
      </form>
    </main>
  );
}
