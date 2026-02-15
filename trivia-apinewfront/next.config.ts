import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// Раздельные dist-папки для dev и build, чтобы избежать EPERM lock-конфликтов на Windows:
// - `next dev`   (NODE_ENV=development) → .next (стандартный)
// - `next build` (NODE_ENV=production)  → .next-build
// Можно переопределить через env: NEXT_DIST_DIR=custom-dir
const isProduction = process.env.NODE_ENV === 'production';
const distDir = process.env.NEXT_DIST_DIR || (isProduction ? '.next-build' : undefined);

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactCompiler: true,
  ...(distDir ? { distDir } : {}),
};

// Интеграция next-intl для мультиязычной поддержки
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
