import { suite, test } from 'node:test';
import { eslintConfig as baseLintConfig } from '../../config/linter/base.js';
import { equal } from 'node:assert';
import { eslintConfig as nextLintConfig } from '../../config/linter/next.js';

await suite('Validate Successful Import of Linting Configurations', async () => {
    await test('Base - Import is of object type', () => {
        /** Result of the one possible test for the imported data. */
        const result = typeof baseLintConfig === 'object';

        // Check result of the test condition
        equal(result, true, 'Imported data is not an object and would not work as intended');
    });

    await test('Next.js - Import is of object type', () => {
        /** Result of the one possible test for the imported data. */
        const result = typeof nextLintConfig === 'object';

        // Check result of the test condition
        equal(result, true, 'Imported data is not an object and would not work as intended');
    });
});
