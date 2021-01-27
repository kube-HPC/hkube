const { uid } = require('@hkube/uid');
const { createDataSource, createSnapshot } = require('./api');

const generateSnapshot = (name, query) => ({
    name,
    query: query || `${name} query`,
});

/**
 * @returns {Promise<{
 *     dataSource: import('@hkube/db/lib/DataSource').DataSource;
 *     generatedSnapshots: { name: string; query: string }[];
 *     createdSnapshots: import('@hkube/db/lib/Snapshots').Snapshot[];
 * }>}
 */
const setupDataSource = async (numberOfSnapshots = 1) => {
    const name = uid();
    const { body: dataSource } = await createDataSource({ body: { name } });
    const generatedSnapshots = new Array(numberOfSnapshots)
        .fill(0)
        .map((_, ii) => generateSnapshot(`snapshot-${ii}`));
    /** @type {import('@hkube/db/lib/Snapshots').Snapshot[]} */
    const createdSnapshots = await Promise.all(
        generatedSnapshots.map(snapshot =>
            createSnapshot({
                id: dataSource.id,
                snapshot,
            })
        )
    );
    return {
        dataSource,
        generatedSnapshots,
        createdSnapshots: createdSnapshots.map(res => res.body),
    };
};

module.exports = setupDataSource;
