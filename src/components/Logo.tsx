// Marca Kamposzoe en versión chica (sin el nombre, que no se lee a este tamaño). Emblema completo: public/logo.svg
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="50" fill="#1f4a33" />
      <circle cx="50" cy="50" r="41" fill="#111" stroke="#fff" strokeWidth="3" />
      <g transform="translate(13 12) scale(0.74)">
        <path
          fill="#fff"
          d="M48 8 C55 6 61 10 61 17 C61 22 58 25 59 29 C67 34 72 45 69 57 C67 66 61 71 60 78 C59 86 64 91 69 89 C74 87 74 80 69 79 C66 78.5 64 81 66 83 C63 84 61 81 62 78.5 C64 74 71 75 73 80 C75 87 69 94 62 92 C54 90 50 82 51 75 C52 68 45 64 42 57 C39 50 41 42 46 38 C47 36 46 34 44 33 C40 32 33 32 23 31.6 C19.5 31.4 19.5 27.9 23 27.8 C31 27.4 37 26 39 23 C40 16 43 10 48 8 Z"
        />
        <path fill="#fff" d="M68.5 45 C75 42 79 48 75 54 C73 56.5 70.5 56 69 54 Z" />
        <circle cx="47" cy="19.5" r="2.6" fill="#111" />
      </g>
    </svg>
  );
}
