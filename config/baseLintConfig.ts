import eslint from '@eslint/js';
import globals from 'globals';
import jsdoc from 'eslint-plugin-jsdoc';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

/**
 * Array of configuration objects merged together to form baseline for linting of the code.
 */
export const eslintConfig = tseslint.config(
    eslint.configs.recommended,
    jsdoc.configs['flat/recommended-typescript'],
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        'ignores': ['eslint.config.mjs']
    },
    {
        'languageOptions': {
            'globals': {
                ...globals.browser,
                ...globals.mocha,
                ...globals.node,
                ...globals.es2021
            },
            'parserOptions': {
                'projectService': true
            }
        },
        'linterOptions': { 'reportUnusedDisableDirectives': true },
        'plugins': {
            jsdoc,
            stylistic
        },
        'rules': {
            '@typescript-eslint/class-methods-use-this': 'warn',
            '@typescript-eslint/consistent-return': 'warn',
            '@typescript-eslint/default-param-last': 'warn',
            '@typescript-eslint/explicit-function-return-type': 'warn',
            '@typescript-eslint/init-declarations': 'warn',
            '@typescript-eslint/no-array-constructor': 'warn',
            '@typescript-eslint/no-empty-function': 'warn',
            '@typescript-eslint/no-implied-eval': 'warn',
            '@typescript-eslint/no-invalid-this': 'warn',
            '@typescript-eslint/no-loop-func': 'warn',
            '@typescript-eslint/no-misused-promises': [
                'warn',
                {
                    'checksVoidReturn': {
                        'arguments': false
                    }
                }
            ],
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-restricted-imports': 'warn',
            '@typescript-eslint/no-shadow': 'warn',
            '@typescript-eslint/no-unused-expressions': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    'argsIgnorePattern': '^_',
                    'caughtErrors': 'none'
                }
            ],
            '@typescript-eslint/no-use-before-define': 'warn',
            '@typescript-eslint/no-useless-constructor': 'warn',
            '@typescript-eslint/prefer-destructuring': 'warn',
            '@typescript-eslint/prefer-promise-reject-errors': 'warn',
            '@typescript-eslint/require-await': 'warn',
            '@typescript-eslint/restrict-template-expressions': [
                'warn',
                {
                    'allowNumber': true
                }
            ],
            'accessor-pairs': 'warn',
            'array-callback-return': 'warn',
            'arrow-body-style': 'warn',
            'block-scoped-var': 'warn',
            'camelcase': 'warn',
            'capitalized-comments': 'warn',
            'class-methods-use-this': 'off',
            'consistent-return': 'off',
            'consistent-this': 'warn',
            'curly': 'warn',
            'default-case': 'warn',
            'default-case-last': 'warn',
            'default-param-last': 'off',
            'eqeqeq': 'warn',
            'func-name-matching': 'warn',
            'func-names': 'warn',
            'func-style': [
                'warn',
                'declaration'
            ],
            'grouped-accessor-pairs': 'warn',
            'guard-for-in': 'warn',
            'id-denylist': 'warn',
            'id-length': 'warn',
            'id-match': 'warn',
            'init-declarations': 'off',
            'jsdoc/check-alignment': 'warn',
            'jsdoc/check-indentation': [
                'warn',
                {
                    'excludeTags': [
                        'example',
                        'returns'
                    ]
                }
            ],
            'jsdoc/informative-docs': 'warn',
            'jsdoc/no-blank-blocks': 'warn',
            'jsdoc/no-multi-asterisks': [
                'warn',
                {
                    'allowWhitespace': true
                }
            ],
            'jsdoc/require-asterisk-prefix': 'warn',
            'jsdoc/require-description-complete-sentence': [
                'warn',
                {
                    'abbreviations': ['etc.', 'e.g.', 'i.e.']
                }
            ],
            'jsdoc/require-jsdoc': [
                'warn',
                {
                    'contexts': [
                        'ClassBody > PropertyDefinition',
                        /* eslint-disable-next-line */
                        'VariableDeclaration:not(:has(VariableDeclarator[id.type=\"ArrayPattern\"])):not(:has(VariableDeclarator[id.type=\"ObjectPattern\"])):not(ExportNamedDeclaration > VariableDeclaration):not(ForOfStatement > VariableDeclaration):not(ForInStatement > VariableDeclaration):not(ForStatement > VariableDeclaration)',
                        'TSInterfaceDeclaration',
                        'TSPropertySignature',
                        'TSMethodSignature',
                        'TSTypeAliasDeclaration'
                    ],
                    'enableFixer': false,
                    'require': {
                        'ArrowFunctionExpression': true,
                        'ClassDeclaration': true,
                        'ClassExpression': true,
                        'FunctionDeclaration': true,
                        'FunctionExpression': true,
                        'MethodDefinition': true
                    }
                }
            ],
            'jsdoc/require-param': 'warn',
            'jsdoc/valid-types': 'warn',
            'max-classes-per-file': 'warn',
            'max-depth': [
                'warn',
                7
            ],
            'max-nested-callbacks': 'warn',
            'new-cap': 'warn',
            'no-alert': 'warn',
            'no-array-constructor': 'off',
            'no-bitwise': 'warn',
            'no-caller': 'warn',
            'no-console': 'warn',
            'no-constructor-return': 'warn',
            'no-continue': 'warn',
            'no-div-regex': 'warn',
            'no-duplicate-imports': 'warn',
            'no-else-return': 'warn',
            'no-empty-function': 'off',
            'no-eq-null': 'warn',
            'no-eval': 'warn',
            'no-extend-native': 'warn',
            'no-extra-bind': 'warn',
            'no-extra-label': 'warn',
            'no-implicit-coercion': 'warn',
            'no-implicit-globals': 'warn',
            'no-implied-eval': 'off',
            'no-invalid-this': 'off',
            'no-iterator': 'warn',
            'no-label-var': 'warn',
            'no-labels': [
                'warn',
                {
                    'allowLoop': true
                }
            ],
            'no-lone-blocks': 'warn',
            'no-lonely-if': 'warn',
            'no-loop-func': 'off',
            'no-multi-assign': 'warn',
            'no-multi-str': 'warn',
            'no-nested-ternary': 'warn',
            'no-new': 'warn',
            'no-new-func': 'warn',
            'no-new-wrappers': 'warn',
            'no-object-constructor': 'warn',
            'no-octal-escape': 'warn',
            'no-param-reassign': 'warn',
            'no-plusplus': [
                'warn',
                {
                    'allowForLoopAfterthoughts': true
                }
            ],
            'no-promise-executor-return': 'warn',
            'no-proto': 'warn',
            'no-restricted-exports': 'warn',
            'no-restricted-globals': 'warn',
            'no-restricted-imports': 'off',
            'no-restricted-properties': 'warn',
            'no-restricted-syntax': 'warn',
            'no-return-assign': 'warn',
            'no-script-url': 'warn',
            'no-self-compare': 'warn',
            'no-sequences': 'warn',
            'no-shadow': 'off',
            'no-template-curly-in-string': 'warn',
            'no-throw-literal': 'warn',
            'no-undef-init': 'warn',
            'no-undefined': 'warn',
            'no-underscore-dangle': 'warn',
            'no-unmodified-loop-condition': 'warn',
            'no-unneeded-ternary': 'warn',
            'no-unreachable-loop': 'warn',
            'no-unused-expressions': 'off',
            'no-unused-vars': 'off',
            'no-use-before-define': 'off',
            'no-useless-call': 'warn',
            'no-useless-computed-key': 'warn',
            'no-useless-concat': 'warn',
            'no-useless-constructor': 'off',
            'no-useless-rename': 'warn',
            'no-useless-return': 'warn',
            'no-var': 'warn',
            'no-warning-comments': [
                'warn',
                {
                    'terms': [
                        'fixme',
                        'xxx'
                    ]
                }
            ],
            'object-shorthand': 'warn',
            'one-var': [
                'warn',
                'never'
            ],
            'operator-assignment': 'warn',
            'prefer-arrow-callback': 'warn',
            'prefer-const': 'warn',
            'prefer-destructuring': 'off',
            'prefer-exponentiation-operator': 'warn',
            'prefer-named-capture-group': 'warn',
            'prefer-numeric-literals': 'warn',
            'prefer-object-spread': 'warn',
            'prefer-promise-reject-errors': 'off',
            'prefer-regex-literals': 'warn',
            'prefer-rest-params': 'warn',
            'prefer-spread': 'warn',
            'prefer-template': 'warn',
            'radix': 'warn',
            'require-atomic-updates': 'warn',
            'require-await': 'off',
            'require-unicode-regexp': 'warn',
            'sort-imports': 'warn',
            'sort-keys': 'warn',
            'sort-vars': 'warn',
            'strict': 'warn',
            'stylistic/array-bracket-newline': 'warn',
            'stylistic/array-bracket-spacing': 'warn',
            'stylistic/array-element-newline': [
                'warn',
                'consistent'
            ],
            'stylistic/arrow-parens': 'warn',
            'stylistic/arrow-spacing': 'warn',
            'stylistic/block-spacing': 'warn',
            'stylistic/brace-style': [
                'warn',
                '1tbs',
                {
                    'allowSingleLine': true
                }
            ],
            'stylistic/comma-dangle': 'warn',
            'stylistic/comma-spacing': 'warn',
            'stylistic/comma-style': 'warn',
            'stylistic/computed-property-spacing': 'warn',
            'stylistic/dot-location': [
                'warn',
                'property'
            ],
            'stylistic/eol-last': 'warn',
            'stylistic/function-call-argument-newline': [
                'warn',
                'consistent'
            ],
            'stylistic/function-call-spacing': 'warn',
            'stylistic/function-paren-newline': 'warn',
            'stylistic/generator-star-spacing': 'warn',
            'stylistic/implicit-arrow-linebreak': 'warn',
            'stylistic/jsx-quotes': 'warn',
            'stylistic/key-spacing': 'warn',
            'stylistic/keyword-spacing': 'warn',
            'stylistic/lines-around-comment': [
                'warn',
                {
                    'allowBlockStart': true,
                    'allowClassStart': true,
                    'allowEnumStart': true,
                    'allowInterfaceStart': true,
                    'allowModuleStart': true,
                    'allowObjectStart': true,
                    'allowTypeStart': true,
                    'beforeBlockComment': true,
                    'beforeLineComment': true
                }
            ],
            'stylistic/lines-between-class-members': [
                'warn',
                'always',
                {
                    'exceptAfterSingleLine': true
                }
            ],
            'stylistic/multiline-comment-style': 'warn',
            'stylistic/multiline-ternary': [
                'warn',
                'always-multiline'
            ],
            'stylistic/new-parens': 'warn',
            'stylistic/newline-per-chained-call': 'warn',
            'stylistic/no-confusing-arrow': 'warn',
            'stylistic/no-extra-parens': [
                'warn',
                'all',
                {
                    'nestedBinaryExpressions': false
                }
            ],
            'stylistic/no-extra-semi': 'warn',
            'stylistic/no-floating-decimal': 'warn',
            'stylistic/no-mixed-operators': 'warn',
            'stylistic/no-mixed-spaces-and-tabs': 'warn',
            'stylistic/no-multi-spaces': 'warn',
            'stylistic/no-multiple-empty-lines': 'warn',
            'stylistic/no-tabs': 'warn',
            'stylistic/no-trailing-spaces': 'warn',
            'stylistic/no-whitespace-before-property': 'warn',
            'stylistic/nonblock-statement-body-position': 'warn',
            'stylistic/object-curly-newline': 'warn',
            'stylistic/object-curly-spacing': [
                'warn',
                'always'
            ],
            'stylistic/object-property-newline': 'warn',
            'stylistic/one-var-declaration-per-line': 'warn',
            'stylistic/operator-linebreak': 'warn',
            'stylistic/padded-blocks': [
                'warn',
                'never'
            ],
            'stylistic/padding-line-between-statements': [
                'warn',
                {
                    'blankLine': 'any',
                    'next': [
                        'const',
                        'let',
                        'var'
                    ],
                    'prev': [
                        'const',
                        'let',
                        'var'
                    ]
                },
                {
                    'blankLine': 'always',
                    'next': 'iife',
                    'prev': 'iife'
                },
                {
                    'blankLine': 'never',
                    'next': 'import',
                    'prev': 'import'
                },
                {
                    'blankLine': 'always',
                    'next': [
                        'block-like',
                        'break',
                        'class',
                        'const',
                        'do',
                        'expression',
                        'export',
                        'for',
                        'function',
                        'if',
                        'let',
                        'return',
                        'switch',
                        'throw',
                        'try',
                        'var',
                        'while',
                        'with'
                    ],
                    'prev': '*'
                },
                {
                    'blankLine': 'never',
                    'next': [
                        'case',
                        'default'
                    ],
                    'prev': '*'
                }
            ],
            'stylistic/quote-props': 'warn',
            'stylistic/quotes': [
                'warn',
                'single'
            ],
            'stylistic/rest-spread-spacing': 'warn',
            'stylistic/semi': 'warn',
            'stylistic/semi-spacing': 'warn',
            'stylistic/semi-style': 'warn',
            'stylistic/space-before-blocks': 'warn',
            'stylistic/space-before-function-paren': [
                'warn',
                {
                    'anonymous': 'always',
                    'asyncArrow': 'always',
                    'named': 'never'
                }
            ],
            'stylistic/space-in-parens': 'warn',
            'stylistic/space-infix-ops': 'warn',
            'stylistic/space-unary-ops': 'warn',
            'stylistic/spaced-comment': 'warn',
            'stylistic/switch-colon-spacing': 'warn',
            'stylistic/template-curly-spacing': [
                'warn',
                'always'
            ],
            'stylistic/template-tag-spacing': 'warn',
            'stylistic/wrap-iife': 'warn',
            'stylistic/wrap-regex': 'warn',
            'stylistic/yield-star-spacing': 'warn',
            'symbol-description': 'warn',
            'unicode-bom': 'warn',
            'vars-on-top': 'warn',
            'yoda': 'warn'
        }
    },
    {
        'rules': {
            'stylistic/lines-around-comment': 'off'
        },
        'settings': {
            'stylistic': {
                'contexts': ['TSInterfaceDeclaration']
            }
        }
    }
);
