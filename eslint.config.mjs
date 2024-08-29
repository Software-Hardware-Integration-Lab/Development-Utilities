import { eslintConfig } from './bin/index.js';

export default [
    ...eslintConfig,
    {
        'ignores': [
            'bin/'
        ]
    }
];
