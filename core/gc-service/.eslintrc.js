module.exports = {
    "extends": ["airbnb-base", "plugin:security/recommended"],
    "env": {
        "es6": true,
        "node": true,
        "mocha": true
    },
    "plugins": [
        "chai-friendly",
        "security"
    ],
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 2020
    },
    "rules": {
        "no-param-reassign": "error",
        "prefer-template": "error",
        "no-trailing-spaces": "error",
        "no-console": "error",
        "no-use-before-define": "warn",
        "object-curly-spacing": "error",
        "no-var": "error",
        "import/newline-after-import": "off",
        "max-len": ["error", 220],
        "brace-style": ["error", "stroustrup"],
        "indent": ["warn", 4],
        "comma-dangle": "off",
        "no-underscore-dangle": "off",
        "linebreake-style": "off",
        "object-curly-newline": "off",
        "newline-per-chained-call": "off",
        "arrow-body-style": "off",
        "class-methods-use-this": "off",
        "no-unused-expressions": 0,
        "arrow-parens": "off",
        "security/detect-object-injection": "off",
        "security/detect-non-literal-fs-filename": "off",

    }
};