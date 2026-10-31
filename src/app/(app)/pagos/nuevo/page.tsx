import { savePayment } from "../actions";
import PaymentForm from "@/components/PaymentForm";
import { requireAdmin } from "@/lib/session";

export default async function NewPaymentPage() {
  await requireAdmin();
  return (
    <main>
      <h1 className="mb-6 font-display text-3xl leading-tight font-semibold">Nuevo pago fijo</h1>
      <PaymentForm action={savePayment.bind(null, null)} />
    </main>
  );
}
