import prettier from "eslint-config-prettier";
import ts from "typescript-eslint";
import vue from "eslint-plugin-vue";
export default ts.config(
  {
    ignores: [
      "dist/**",
      "packages/*/dist/**",
      "tmp/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
      "apps/client/src/core/catalog.generated.ts",
    ],
  },
  ...ts.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "vue/multi-word-component-names": "off",
      "vue/html-self-closing": "off",
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/html-indent": "off",
    },
  },
  prettier,
  // v-html recebe exclusivamente o renderer compartilhado, que escapa texto e atributos.
  { rules: { "vue/no-v-html": "off" } },
);
