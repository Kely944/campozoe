import type { Metadata } from "next";
import Link from "next/link";
import { CONTACTO } from "../contacto";

export const metadata: Metadata = { title: "Términos de uso · Pendientes" };

export default function Terminos() {
  return (
    <>
      <h1>Términos de uso</h1>
      <p className="text-sm text-stone-500">Última actualización: 1 de noviembre de 2026</p>

      <p>
        <strong>Pendientes</strong> es una herramienta interna del negocio <strong>Campozoe</strong> (Loja, Ecuador). Al usarla aceptas estos
        términos.
      </p>

      <h2>Quién puede usarla</h2>
      <p>
        Solo personas del equipo de Campozoe con una cuenta creada por la administradora. Las cuentas son personales: no compartas tu
        contraseña. Si dejas el equipo, tu acceso se desactiva.
      </p>

      <h2>Avisos por WhatsApp y correo</h2>
      <p>
        Al estar en el equipo recibirás recordatorios de las tareas que tengas asignadas en el número de WhatsApp o correo registrado. Los
        avisos no se envían entre las 21:00 y las 07:00 (hora de Ecuador). Responder <em>Hecho</em> marca la tarea como completada y{" "}
        <em>Recordar en 1 h</em> pausa los avisos por una hora. Si no quieres recibir avisos, pídelo a la administradora.
      </p>

      <h2>Uso correcto</h2>
      <p>
        Usa la aplicación solo para las tareas del negocio y registra información veraz. La información del negocio es confidencial y no debe
        compartirse fuera del equipo.
      </p>

      <h2>Disponibilidad</h2>
      <p>
        Hacemos lo posible para que la aplicación y los avisos funcionen siempre, pero dependen de servicios externos (internet, WhatsApp,
        correo). Ante una tarea crítica, no dependas solo del aviso.
      </p>

      <h2>Datos personales</h2>
      <p>
        El tratamiento de tus datos se explica en la <Link href="/privacidad">Política de privacidad</Link>.
      </p>

      <h2>Contacto</h2>
      <p>
        <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>
      </p>
    </>
  );
}
