module.exports = {
  root: true,
  extends: ['next/core-web-vitals'], // hoặc 'next' nếu không dùng web-vitals
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-empty-function': 'off',
  },
}