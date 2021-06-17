const { uid } = require('@hkube/uid');
const { createDataSource, createSnapshot } = require('./api');

const generateSnapshot = (name, query) => ({
    name,
    query: query || `${name} query`,
});

const setupDataSource = async (numberOfSnapshots = 1) => {
    const name = uid();
    const { body: dataSource } = await createDataSource(name);
    const generatedSnapshots = new Array(numberOfSnapshots)
        .fill(0)
        .map((_, ii) => generateSnapshot(`snapshot-${ii}`));
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
