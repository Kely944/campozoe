import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // RF-32: el historial de ventas en Excel puede pasar del límite de 1 MB por defecto.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
