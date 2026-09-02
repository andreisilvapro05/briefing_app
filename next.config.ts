import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Padrão é 1MB — upload de foto de perfil (mesmo comprimida no
      // navegador) precisa de folga; a Vercel corta em ~4,5MB de qualquer
      // jeito, então 4mb é o teto prático.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
