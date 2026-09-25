import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // App independente dentro do repositório: não herdar a raiz do projeto pai.
  turbopack: { root: path.join(__dirname) },
  // Seed com dados reais lido via fs em runtime: incluir no bundle serverless.
  outputFileTracingIncludes: { '/**': ['./data/**'] },
};

export default nextConfig;
