import { eslintConfig as baselineConfig } from './base.js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import nextTypeScript from 'eslint-config-next/typescript';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import nextVitals from 'eslint-config-next/core-web-vitals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/** Baseline configuration used for linting Next.JS projects the SHI - Lab way. */
export const eslintConfig = defineConfig([
    ...baselineConfig,
    ...(nextVitals as ReturnType<typeof defineConfig>),
    ...(nextTypeScript as ReturnType<typeof defineConfig>),
    react.configs.flat['recommended'],
    react.configs.flat['jsx-runtime'],
    reactHooks.configs.flat.recommended,
    {
        'languageOptions': { 'globals': { ...globals.browser } },
        'settings': {
            'react': {
                'version': 'detect'
            }
        }
    }
]);
