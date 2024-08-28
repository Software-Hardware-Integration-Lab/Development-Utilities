import { assert } from 'chai';
import { eslintConfig } from '../config/baseLintConfig.mjs';
import { it } from 'mocha';

describe('Validate Successful Import of Linting Configuration', () => {
    it('Import is of object type', (done) => {
        /** Result of the one possible test for the imported data. */
        const result = typeof eslintConfig === 'object';

        // Check result of the test condition
        assert.isTrue(result, 'Imported data is not an object and would not work as intended');

        // Complete the testing section
        done();
    });
});
