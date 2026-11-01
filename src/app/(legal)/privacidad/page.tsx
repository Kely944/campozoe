import type { Metadata } from "next";
import { CONTACTO } from "../contacto";

export const metadata: Metadata = { title: "Política de privacidad · Pendientes" };

export default function Privacidad() {
  return (
    <>
      <h1>Política de privacidad</h1>
      <p className="text-sm text-stone-500">Última actualización: 1 de noviembre de 2026</p>

      <p>
        <strong>Pendientes</strong> es una herramienta interna del negocio <strong>Campozoe</strong> (Loja, Ecuador) para organizar pedidos,
        cobros, pagos y otras tareas, y avisar al equipo por WhatsApp o correo cuando se acerca un plazo. Solo la usan personas del equipo,
        con cuentas creadas por la administradora; no está abierta al público.
      </p>

      <h2>Responsable</h2>
      <p>
        Campozoe. Contacto para cualquier consulta sobre datos personales: <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
      </p>

      <h2>Qué datos tratamos</h2>
      <ul>
        <li>De las personas del equipo: nombre, correo electrónico, número de teléfono (WhatsApp) y rol en la aplicación.</li>
        <li>Las tareas y registros del negocio que el equipo ingresa (pedidos, cobros, pagos, producción y reportes).</li>
        <li>
          De WhatsApp: el número que recibe cada aviso, el estado de entrega y las respuestas a los botones <em>Hecho</em> y{" "}
          <em>Recordar en 1 h</em>. No leemos ni guardamos otros mensajes.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <p>
        Únicamente para enviar recordatorios de tareas a la persona responsable, insistir hasta que la tarea se marque como hecha, avisar a la
        persona de respaldo si sigue pendiente y registrar quién la completó. No enviamos publicidad ni mensajes a clientes.
      </p>

      <h2>Con quién se comparten</h2>
      <p>No vendemos ni cedemos datos personales. Para funcionar, la aplicación usa estos proveedores, que tratan los datos solo por cuenta nuestra:</p>
      <ul>
        <li>Supabase (base de datos y acceso), Vercel (alojamiento de la aplicación).</li>
        <li>Meta / WhatsApp Business Platform (envío de avisos y recepción de las respuestas a los botones).</li>
        <li>Resend (envío de avisos por correo cuando WhatsApp no está disponible).</li>
      </ul>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras la persona forme parte del equipo y el negocio necesite el historial de tareas. Al dejar el equipo, su cuenta se elimina. Los
        respaldos cifrados de la base se conservan 30 días.
      </p>

      <h2>Seguridad</h2>
      <p>
        El acceso requiere usuario y contraseña; los permisos se controlan en la base de datos según el rol, la información financiera solo la
        ve la administradora, y las conexiones van cifradas (HTTPS).
      </p>

      <h2 id="eliminacion">Tus derechos y eliminación de datos</h2>
      <p>
        Conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador, puedes pedir acceso, rectificación, actualización o
        eliminación de tus datos, u oponerte a su tratamiento. Para pedir que se eliminen tus datos:
      </p>
      <ul>
        <li>
          Escribe a <a href={`mailto:${CONTACTO}?subject=Eliminación de datos`}>{CONTACTO}</a> con el asunto «Eliminación de datos», indicando
          tu nombre y el correo o número de teléfono registrado.
        </li>
        <li>Eliminaremos tu cuenta, tu número y tu correo, y te confirmaremos por el mismo medio en un plazo máximo de 15 días.</li>
        <li>Los registros de tareas del negocio pueden conservarse sin datos que te identifiquen.</li>
      </ul>

      <h2>Cambios</h2>
      <p>Si cambiamos esta política, actualizaremos la fecha de arriba y avisaremos al equipo.</p>
    </>
  );
}
