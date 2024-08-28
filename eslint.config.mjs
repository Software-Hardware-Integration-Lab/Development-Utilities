import { eslintConfig } from './bin/index.mjs';

export default [
    ...eslintConfig,
    {
        'ignores': [
            'bin/'
        ]
    }
];
