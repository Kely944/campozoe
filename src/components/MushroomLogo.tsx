// Marca de la app: un champiñón de un solo color (toma currentColor)
export default function MushroomLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M3 16C3 8.8 8.8 4 16 4s13 4.8 13 12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2zm8.5-6.2a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zm7-2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm3.5 4.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"
      />
      <path d="M12 19.5h8V25a4 4 0 0 1-8 0z" />
    </svg>
  );
}
