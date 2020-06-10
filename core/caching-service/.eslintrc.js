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
        "ecmaVersion": 2018
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
        "max-len": ["error", 200],
        "brace-style": ["error", "stroustrup"],
        "indent": ["warn", 4],
        "comma-dangle": "off",
        "no-underscore-dangle": "off",
        "linebreake-style": "off",
        "object-curly-newline": "off",
        "newline-per-chained-call": "off",
        "arrow-body-style": "off",
        "arrow-parens": [2, "as-needed", { "requireForBlockBody": true }],
        "class-methods-use-this": "off",
        "no-unused-expressions": 0,
        "chai-friendly/no-unused-expressions": 2
    }
};
