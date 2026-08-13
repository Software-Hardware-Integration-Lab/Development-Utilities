import { describe, expect, it } from 'vitest';
import { eslintConfig as baseLintConfig } from '../../config/linter/base.js';
import { eslintConfig as nextLintConfig } from '../../config/linter/next.js';

describe('Validate Successful Import of Linting Configurations', () => {
    it('Base - Import is of object type', () => {
        /** Result of the one possible test for the imported data. */
        const result = typeof baseLintConfig === 'object';

        // Check result of the test condition
        expect(result, 'Imported data is not an object and would not work as intended').toBe(true);
    });

    it('Next.js - Import is of object type', () => {
        /** Result of the one possible test for the imported data. */
        const result = typeof nextLintConfig === 'object';

        // Check result of the test condition
        expect(result, 'Imported data is not an object and would not work as intended').toBe(true);
    });
});
