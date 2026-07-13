# Development Utilities [![Unit Test](https://github.com/Software-Hardware-Integration-Lab/Development-Utilities/actions/workflows/Test-Unit.yml/badge.svg)](https://github.com/Software-Hardware-Integration-Lab/Development-Utilities/actions/workflows/Test-Unit.yml) [![Lint Check](https://github.com/Software-Hardware-Integration-Lab/Development-Utilities/actions/workflows/Test-Lint.yml/badge.svg)](https://github.com/Software-Hardware-Integration-Lab/Development-Utilities/actions/workflows/Test-Lint.yml) [![CodeQL](https://github.com/Software-Hardware-Integration-Lab/Development-Utilities/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/Software-Hardware-Integration-Lab/Development-Utilities/actions/workflows/github-code-scanning/codeql)[![NPM Version](https://img.shields.io/npm/v/%40software-hardware-integration-lab%2Fdevelopment-utilities)](https://www.npmjs.com/package/@software-hardware-integration-lab/development-utilities)

Shared development-time configurations for TypeScript, ESLint (flat config), and Next.js. These utilities are dev-only and should not ship with application runtime artifacts.

These configurations are not exhaustive and might require bespoke changes once extended or included in your target repo (based on the configuration used).

## Installation

```bash
npm install --save-dev @software-hardware-integration-lab/development-utilities
```

### Note

Do not import anything from this package in production/runtime code.

## TS Config configuration

Since it is not a code but just configuration file, it would require particular handling to use:

in tsconfig.json make these changes

```jsonc
{
  "extends": "@software-hardware-integration-lab/development-utilities/config/typescript/base.json",
  "compilerOptions": {
    "outDir": "./bin" // Adjust for your project
  }
  // ... Any other options that need to override base behavior
}
```

## Lint configuration

This project is using flat file for eslint (best results achieved with version >=9.9.0) and the intention to be compatible with that style only:

In `eslint.config.(m)js` make these changes:

### Normal (Non-UI)

```TypeScript
import { eslintConfig } from '@software-hardware-integration-lab/development-utilities/optimized/lint/base.js'
import { defineConfig } from 'eslint/config'

export default defineConfig(eslintConfig)
```

### User Interface (Next.JS)

```TypeScript
import { eslintConfig } from '@software-hardware-integration-lab/development-utilities/optimized/lint/next.js'
import { defineConfig } from 'eslint/config'

export default defineConfig([
    ...eslintConfig,
    // Add project-specific rules, ignores, or plugins here
])
```

## Next.js configuration

in next.config.(m)js make these changes

```TypeScript
import { nextConfig } from '@software-hardware-integration-lab/development-utilities';

export default {
  ...nextConfig,
  ... // any other options that need to override base behavior
};
```

## Scope and intent

- Dev-only: configurations used for authoring, linting, and building. They should not be bundled into final application artifacts.
- Centralized defaults: opinionated baselines to standardize behavior across repos.
- Opt-in overrides: extend and override per project as needed.

## Compatibility

- Node.JS (Latest LTS)
- ES Lint >= 10.7
- TypeScript >= 6.0
- Vite.JS - Coming soon!
