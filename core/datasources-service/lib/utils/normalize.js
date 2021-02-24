/**
 * Builds a key value collection. Accepts a mapper function to transform the value objects while
 * running.
 *
 * @param {Object[]} collection
 * @param {string}   [id]
 * @param {function} [mapper]
 */
const normalize = (collection, id = 'id', mapper) =>
    collection.reduce(
        (acc, item) => ({
            ...acc,
            [item[id]]: mapper ? mapper(item) : item,
        }),
        {}
    );

module.exports = normalize;
