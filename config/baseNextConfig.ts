import { NextConfig } from 'next';

/**
 * An object that represents collection of settings to define behavior of Next.js application.
 */
export const nextConfig: NextConfig = {
    // Disable client side render warning, since this whole project is CSR mode.
    'experimental': {
        'missingSuspenseWithCSRBailout': false
    },

    // Render as static HTML
    'output': 'export',

    // @todo Enable strict mode dev checks again when https://github.com/microsoft/use-disposable/issues/31 gets fixed.
    'reactStrictMode': false

    /*
     * // Optional: Change links `/me` -> `/me/` and emit `/me.html` -> `/me/index.html`
     * // trailingSlash: true,
     *
     * // Optional: Prevent automatic `/me` -> `/me/`, instead preserve `href`
     * // skipTrailingSlashRedirect: true,
     *
     * // Optional: Change the output directory `out` -> `dist`
     * // distDir: 'out',
     */
};
