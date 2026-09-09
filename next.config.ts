import type { NextConfig } from 'next';

// GitHub Pages serves project sites below `/<repository-name>/`.
// The workflow supplies that prefix during the static build.
const assetPath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '')
  .replace(/^\/+|\/+$/g, '');
const pathPrefix = assetPath ? `/${assetPath}` : '';

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: pathPrefix,
  trailingSlash: true,
};

export default nextConfig;
