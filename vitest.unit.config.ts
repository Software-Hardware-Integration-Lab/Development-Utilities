import { defineConfig } from 'vitest/config';

export default defineConfig({
    'test': {
        'coverage': {
            'include': ['config/**/*.ts'],
            'provider': 'v8',
            'reportsDirectory': 'coverage/unit'
        },
        'include': ['test/unit/**/*.test.ts']
    }
});
