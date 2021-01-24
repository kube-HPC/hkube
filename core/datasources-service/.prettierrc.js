module.exports = {
    jsxBracketSameLine: true,
    singleQuote: true,
    trailingComma: 'es5',
    arrowParens: 'avoid',
    tabWidth: 4,
    overrides: [
        {
            files: '*.js',
            options: {
                parser: 'jsdoc-parser',
            },
        },
    ],
};
