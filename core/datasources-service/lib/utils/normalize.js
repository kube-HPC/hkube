/**
 * Builds a key value collection.
 * Accepts a mapper function to transform the value objects while unning.
 */
const normalize = (collection, id = 'id', mapper) => collection.reduce((acc, item) => ({
    ...acc,
    [item[id]]: mapper ? mapper(item) : item,
}), {});

module.exports = normalize;
