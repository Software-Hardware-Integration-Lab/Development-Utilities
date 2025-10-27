import { defineConfig, globalIgnores } from 'eslint/config';
import { eslintConfig as baselineConfig } from './base.js';
import globals from 'globals';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import nextVitals from 'eslint-config-next/core-web-vitals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/** Baseline configuration used for linting Next.JS projects the SHI - Lab way. */
export const eslintConfig = defineConfig([
    ...baselineConfig,
    {
        'languageOptions': { 'globals': { ...globals.browser } },
        'settings': { 'react': { 'version': 'detect' } }
    },
    react.configs.flat['recommended'],
    react.configs.flat['jsx-runtime'],
    reactHooks.configs.flat.recommended,
    ...(nextVitals as ReturnType<typeof defineConfig>),
    globalIgnores([
        'next.config.mjs',
        'next.config.js',
        'next-env.d.ts',
        '.next/**',
        'out/**',
        'build/**',
        'jest.config.mjs'
    ])
]);
