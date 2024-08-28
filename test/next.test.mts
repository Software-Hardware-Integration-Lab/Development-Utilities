import { assert } from 'chai';
import { it } from 'mocha';
import { nextConfig } from '../config/baseNextConfig.mjs';

describe('Validate Successful Import of Next.js configuration', () => {
    it('Import is of object type', (done) => {
        /** Result of the one possible test for the imported data. */
        const result = typeof nextConfig === 'object';

        // Check result of the test condition
        assert.isTrue(result, 'Imported data is not an object and would not work as intended');

        // Complete the testing section
        done();
    });
});
