import { defineConfig, globalIgnores } from 'eslint/config';
import { eslintConfig as baselineConfig } from './base.js';
import reactHooks from 'eslint-plugin-react-hooks';

/** Baseline configuration used for linting Next.JS projects the SHI - Lab way. */
export const eslintConfig = defineConfig([
    ...baselineConfig,
    {
        'settings': { 'react': { 'version': 'detect' } }
    },
    reactHooks.configs.flat.recommended,
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
