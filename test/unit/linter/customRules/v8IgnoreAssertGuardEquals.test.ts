/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable sort-keys */
import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import v8IgnoreAssertGuardEquals from '../../../../config/linter/customRules/v8IgnoreAssertGuardEquals.js';

const ruleTester = new RuleTester({
    'languageOptions': {
        'ecmaVersion': 2022,
        'sourceType': 'module'
    }
});

describe('v8-ignore-assert-guard-equals', () => {
    it('does not report when assertGuardEquals has an adjacent V8 directive', () => {
        ruleTester.run('v8-ignore-assert-guard-equals', v8IgnoreAssertGuardEquals, {
            'valid': ['/* v8 ignore next -- @preserve */\nassertGuardEquals(actual, expected);'],
            'invalid': []
        });
    });

    it('does not report when assertEquals has no V8 directive', () => {
        ruleTester.run('v8-ignore-assert-guard-equals', v8IgnoreAssertGuardEquals, {
            'valid': ['assertEquals(actual, expected);'],
            'invalid': []
        });
    });

    it('does not report when a separated V8 directive precedes assertEquals', () => {
        ruleTester.run('v8-ignore-assert-guard-equals', v8IgnoreAssertGuardEquals, {
            'valid': ['/* v8 ignore next */\n\nassertEquals(actual, expected);'],
            'invalid': []
        });
    });

    it('does not report when a V8-like block comment precedes assertEquals', () => {
        ruleTester.run('v8-ignore-assert-guard-equals', v8IgnoreAssertGuardEquals, {
            'valid': ['/* v8 ignore next because this is expensive */\nassertEquals(actual, expected);'],
            'invalid': []
        });
    });

    it('does not report when a V8-like line comment precedes assertEquals', () => {
        ruleTester.run('v8-ignore-assert-guard-equals', v8IgnoreAssertGuardEquals, {
            'valid': ['// v8 ignore next\nassertEquals(actual, expected);'],
            'invalid': []
        });
    });

    it('reports and fixes when assertGuardEquals lacks an exact adjacent V8 directive', () => {
        ruleTester.run('v8-ignore-assert-guard-equals', v8IgnoreAssertGuardEquals, {
            'valid': [],
            'invalid': [
                {
                    'code': 'assertGuardEquals(actual, expected);',
                    'errors': [{ 'messageId': 'wrap' }],
                    'output': '/* v8 ignore next -- @preserve */\nassertGuardEquals(actual, expected);'
                },
                {
                    'code': '/* v8 ignore next */\nassertGuardEquals(actual, expected);',
                    'errors': [{ 'messageId': 'wrap' }],
                    'output': '/* v8 ignore next -- @preserve */\nassertGuardEquals(actual, expected);'
                },
                {
                    'code': '// v8 ignore next\nassertGuardEquals(actual, expected);',
                    'errors': [{ 'messageId': 'wrap' }],
                    'output': '// v8 ignore next\n/* v8 ignore next -- @preserve */\nassertGuardEquals(actual, expected);'
                },
                {
                    'code': '/* v8 ignore next */\n\nassertGuardEquals(actual, expected);',
                    'errors': [{ 'messageId': 'wrap' }],
                    'output': '/* v8 ignore next */\n\n/* v8 ignore next -- @preserve */\nassertGuardEquals(actual, expected);'
                },
                {
                    'code': '/* v8 ignore next */\n/* a related explanation */\nassertGuardEquals(actual, expected);',
                    'errors': [{ 'messageId': 'wrap' }],
                    'output': '/* v8 ignore next */\n/* a related explanation */\n/* v8 ignore next -- @preserve */\nassertGuardEquals(actual, expected);'
                },
                {
                    'code': '/* v8 ignore next because this is expensive */\nassertGuardEquals(actual, expected);',
                    'errors': [{ 'messageId': 'wrap' }],
                    'output': '/* v8 ignore next because this is expensive */\n/* v8 ignore next -- @preserve */\nassertGuardEquals(actual, expected);'
                }
            ]
        });
    });
});
