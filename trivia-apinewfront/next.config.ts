import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// On Windows, the default ".next" directory in this workspace can be locked by ACL/owner mismatch.
// Use a separate dist dir to avoid EPERM unlink issues during local builds.
const windowsDistDir = '.next-win';
const distDir = process.platform === 'win32' ? windowsDistDir : '.next';

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactCompiler: true,
  distDir,
};

// Интеграция next-intl для мультиязычной поддержки
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
