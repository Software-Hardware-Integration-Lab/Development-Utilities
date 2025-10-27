import { baseLintConfig } from './bin/index.js';

export default [
    ...baseLintConfig,
    {
        'ignores': [
            'bin/'
        ]
    }
];
