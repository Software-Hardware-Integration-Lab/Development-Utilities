# Common Utilities [![Unit Test](https://github.com/Software-Hardware-Integration-Lab/Common-Utilities/actions/workflows/Unit-Test.yml/badge.svg)](https://github.com/Software-Hardware-Integration-Lab/Common-Utilities/actions/workflows/Unit-Test.yml) [![Lint Check](https://github.com/Software-Hardware-Integration-Lab/Common-Utilities/actions/workflows/Lint.yml/badge.svg)](https://github.com/Software-Hardware-Integration-Lab/Common-Utilities/actions/workflows/Lint.yml) [![CodeQL](https://github.com/Software-Hardware-Integration-Lab/Common-Utilities/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/Software-Hardware-Integration-Lab/Common-Utilities/actions/workflows/github-code-scanning/codeql)

This project is a collection of configurations to establish some baseline behavior for your TypeScript, linting preferences, etc.

These configurations are not exhaustive and might require bespoke changes once extended or included in your target repo (based on the configuration used).

## tsconfig configuration

Since it is not a code but just configuration file, it would require particular handling to use:

in tsconfig.json make these changes

```json
{
  "extends": "./node_modules/@shi-corp/common-utilities/config/baseTsConfig.json",
  "compilerOptions": {
    "outDir": "<location of the output folder for your project, if it is used>"
  }
  ... // any other options that need to override base behavior
}
```

## Lint configuration

This project is using flat file for eslint (best results achieved with version >=9.9.0) and the intention to be compatible with that style only:

in eslint.config.(m)js make these changes

```js
import { eslintConfig } from '@shi-corp/common-utilities';

export default [
    ...eslintConfig,
    <any other configuration that is specific to you project (excludes, different rules, etc.)>
];
```

## Next.js configuration

in next.config.(m)js make these changes

```js
import { nextConfig } from '@shi-corp/common-utilities';

export default {
  ...nextConfig,
  ... // any other options that need to override base behavior
};
```
