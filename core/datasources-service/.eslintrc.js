module.exports = {
    extends: ['airbnb-base', 'plugin:prettier/recommended'],
    env: {
        node: true,
        mocha: true,
    },
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
    },
    plugins: ['chai-friendly', 'prettier'],
    parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2020,
    },
    rules: {
        'import/no-extraneous-dependencies': [0],
        'no-console': [1, { allow: ['info', 'warn', 'error'] }],
        'import/no-useless-path-segments': [0],
        'no-nested-ternary': [0],
        'import/no-named-as-default-member': [0],
        'import/no-named-as-default': [0],
        'no-underscore-dangle': [0],
        'class-methods-use-this': [0],
    },
};
