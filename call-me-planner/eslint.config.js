// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig, // turn off style rules that Prettier owns
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'android/*', 'ios/*', 'supabase/functions/*'],
  },
]);
