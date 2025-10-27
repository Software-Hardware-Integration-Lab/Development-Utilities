import type { NextConfig } from 'next';

/**
 * An object that represents collection of settings to define behavior of Next.js application.
 */
export const nextConfig: NextConfig = {
    // Render as static HTML
    'output': 'export'

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
