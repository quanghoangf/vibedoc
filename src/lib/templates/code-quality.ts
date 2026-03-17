import type { Template } from './types'

export const CODE_QUALITY_TEMPLATES: Template[] = [
  {
    id: 'eslintrc',
    name: 'ESLint Config',
    description: 'ESLint config with TypeScript strict rules',
    defaultPath: '.eslintrc.json',
    category: 'code-quality',
    content: `{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": true,
    "tsconfigRootDir": "."
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-floating-promises": "error"
  },
  "ignorePatterns": ["dist/", "build/", "node_modules/", "*.config.js"]
}
`,
  },
  {
    id: 'prettierrc',
    name: 'Prettier Config',
    description: 'Prettier formatting config',
    defaultPath: '.prettierrc',
    category: 'code-quality',
    content: `{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
`,
  },
  {
    id: 'tsconfig-strict',
    name: 'tsconfig (strict)',
    description: 'TypeScript config with strict settings for Node/ESM',
    defaultPath: 'tsconfig.json',
    category: 'code-quality',
    content: `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`,
  },
  {
    id: 'editorconfig',
    name: '.editorconfig',
    description: 'EditorConfig for consistent editor settings',
    defaultPath: '.editorconfig',
    category: 'code-quality',
    content: `root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab

[*.{yml,yaml}]
indent_size = 2
`,
  },
  {
    id: 'lint-staged',
    name: 'lint-staged Config',
    description: 'lint-staged config for pre-commit formatting and linting',
    defaultPath: '.lintstagedrc.json',
    category: 'code-quality',
    content: `{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{js,jsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"],
  "*.{css,scss}": ["prettier --write"]
}
`,
  },
  {
    id: 'commitlint',
    name: 'commitlint Config',
    description: 'commitlint config enforcing Conventional Commits',
    defaultPath: 'commitlint.config.js',
    category: 'code-quality',
    content: `module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'chore', 'revert', 'ci', 'build'
    ]],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 200],
  },
}
`,
  },
  {
    id: 'husky-setup',
    name: 'Husky Setup Doc',
    description: 'Documentation for Husky git hooks setup',
    defaultPath: '.husky/README.md',
    category: 'code-quality',
    content: `# Husky Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) to enforce code quality at commit time.

## Setup

After cloning and running \`npm install\`, Husky hooks are auto-installed via the \`prepare\` script.

If hooks aren't running, install manually:

\`\`\`
npx husky install
\`\`\`

## Hooks

| Hook | Command | Purpose |
|------|---------|---------|
| pre-commit | \`lint-staged\` | Lint and format staged files |
| commit-msg | \`commitlint\` | Validate commit message format |
| pre-push | \`npm test\` | Run tests before pushing |

## Skip hooks (emergencies only)

\`\`\`
git commit --no-verify -m "emergency fix"
\`\`\`

Use sparingly. CI will still catch failures.
`,
  },
  {
    id: 'vscode-settings',
    name: 'VS Code Settings',
    description: 'VS Code workspace settings for the project',
    defaultPath: '.vscode/settings.json',
    category: 'code-quality',
    content: `{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.eol": "\\n",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "[markdown]": {
    "editor.formatOnSave": false
  }
}
`,
  },
  {
    id: 'vscode-extensions',
    name: 'VS Code Extensions',
    description: 'Recommended VS Code extensions for the project',
    defaultPath: '.vscode/extensions.json',
    category: 'code-quality',
    content: `{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "eamodio.gitlens",
    "usernamehw.errorlens",
    "streetsidesoftware.code-spell-checker",
    "github.copilot",
    "christian-kohler.path-intellisense"
  ]
}
`,
  },
]
