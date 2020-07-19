module.exports = {
    "extends": ["airbnb-base"],
    "env": {
        "es6": true,
        "node": true,
        "mocha": true
    },
    "plugins": [
        "chai-friendly"
    ],
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 2020
    },
    "rules": {
        "no-param-reassign": "off",
        "no-use-before-define": "warn",
        "import/newline-after-import": "off",
        "indent": ["warn", 4, { "SwitchCase": 1 }],
        "prefer-template": "off",
        "comma-dangle": "off",
        "no-underscore-dangle": "off",
        "arrow-parens": "off",
        "max-len": ["error", 200],
        "brace-style": ["error", "stroustrup"],
        "no-trailing-spaces": "off",
        "no-console": "error",
        "linebreake-style": "off",
        "no-var": "error",
        "object-curly-spacing": "off",
        "arrow-body-style": "off",
        "class-methods-use-this": "off",
        "no-unused-expressions": 0,
        "chai-friendly/no-unused-expressions": 2,
        "object-curly-newline": ["error", {
            "ObjectExpression": { "minProperties": 5, "multiline": true, "consistent": true },
            "ObjectPattern": "never",
            "ImportDeclaration": "never"
        }],
        "no-continue": "off"
    }
};