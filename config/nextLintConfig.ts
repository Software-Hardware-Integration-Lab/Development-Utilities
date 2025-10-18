import { eslintConfig as baselineConfig } from './baseLintConfig.js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/** Baseline configuration used for linting Next.JS projects the SHI - Lab way. */
export const nextLintConfig = defineConfig(
    ...baselineConfig,
    react.configs.flat['recommended'],
    react.configs.flat['jsx-runtime'],
    (reactHooks as unknown as typeof reactHooks.default).configs.flat['recommended'],
    {
        'languageOptions': { 'globals': { ...globals.browser } },
        'settings': {
            'react': {
                'version': 'detect'
            }
        }
    }
);
