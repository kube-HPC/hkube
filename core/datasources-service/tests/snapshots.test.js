const { uid } = require('@hkube/uid');
const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const {
    createDataSource,
    fetchSnapshot,
    createSnapshot,
    fetchAllSnapshots,
} = require('./utils');
let restUrl;

const generateSnapshot = (name, query) => ({
    name,
    query: query || `${name} query`,
});
/**
 * @returns {{
 *     dataSource: import('@hkube/db/lib/DataSource').DataSource;
 *     generatedSnapshots: { name: string; query: string }[];
 *     createdSnapshots: import('@hkube/db/lib/DataSource').Snapshot;
 * }}
 */
const setupDataSource = async (numberOfSnapshots = 1) => {
    const name = uid();
    // something broke with the logger's debug
    const { body: dataSource } = await createDataSource({ body: { name } });
    const generatedSnapshots = new Array(numberOfSnapshots)
        .fill(0)
        .map((_, ii) => generateSnapshot(`snapshot-${ii}`));
    /** @type {import('@hkube/db/lib/Snapshots').Snapshot[]} */
    const createdSnapshots = await Promise.all(
        generatedSnapshots.map(snapshot =>
            createSnapshot({
                name: dataSource.name,
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

describe('snapshots', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        DATASOURCE_GIT_REPOS_DIR = global.testParams.DATASOURCE_GIT_REPOS_DIR;
        STORAGE_DIR = global.testParams.STORAGE_DIR;
        restPath = `${restUrl}/datasource`;
    });
    it('should fetch snapshot by datasource name and id', async () => {
        const { dataSource, generatedSnapshots } = await setupDataSource(5);
        const response = await fetchAllSnapshots({
            dataSourceId: dataSource.id,
        });
        const items = response.body.map(snapshot => ({
            name: snapshot.name,
            query: snapshot.query,
        }));
        response.body.forEach(entry => {
            expect(entry.dataSource.id).to.eql(dataSource.id);
            expect(entry.dataSource.name).to.eql(dataSource.name);
        });
        expect(items).to.eql(generatedSnapshots);
    });
    it('should fetch snapshot by dataSource and snapshot name', async () => {
        const count = 5;
        const { dataSource, createdSnapshots } = await setupDataSource(count);
        const randomSnapshot =
            createdSnapshots[Math.floor(Math.random() * count)];
        const response = await fetchSnapshot({
            dataSourceName: dataSource.name,
            snapshotName: randomSnapshot.name,
        });
        const { body: snapshot } = response;
        expect(snapshot.dataSource.id).to.eq(dataSource.id);
        expect(snapshot.name).to.eql(randomSnapshot.name);
        expect(snapshot.query).to.eql(randomSnapshot.query);
        expect(snapshot.dataSource).not.to.have.ownProperty('files');
    });
    it('should fetch snapshot by dataSource and snapshot name', async () => {
        const count = 5;
        const { dataSource, createdSnapshots } = await setupDataSource(count);
        const randomSnapshot =
            createdSnapshots[Math.floor(Math.random() * count)];
        const response = await fetchSnapshot({
            dataSourceName: dataSource.name,
            snapshotName: randomSnapshot.name,
            shouldResolve: true,
        });
        const { body: snapshot } = response;
        expect(snapshot.dataSource.id).to.eq(dataSource.id);
        expect(snapshot.name).to.eql(randomSnapshot.name);
        expect(snapshot.query).to.eql(randomSnapshot.query);
        expect(snapshot.dataSource).to.have.ownProperty('files');
    });
    it('should throw snapshot not found error', async () => {
        const { dataSource } = await setupDataSource();
        const response = await fetchSnapshot({
            dataSourceName: dataSource.name,
            snapshotName: 'non-existing-snapshot',
        });
        expect(response.body).to.haveOwnProperty('error');
        expect(response.body.error.code).to.eql(HttpStatus.NOT_FOUND);
        expect(response.body.error.message).to.match(/not found/i);
    });
    it('should throw an error for an already occupied snapshot name', async () => {
        const { dataSource, createdSnapshots } = await setupDataSource();
        const [snapshot] = createdSnapshots;
        const response = await createSnapshot({
            id: dataSource.id,
            name: dataSource.name,
            snapshot: {
                name: snapshot.name,
                query: snapshot.query,
            },
        });
        expect(response.body.error.code).to.eql(HttpStatus.CONFLICT);
        expect(response.body.error.message).to.match(/already exists/i);
    });
});
