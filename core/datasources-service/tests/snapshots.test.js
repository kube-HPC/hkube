const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const {
    fetchSnapshot,
    createSnapshot,
    fetchAllSnapshots,
    createDataSource,
} = require('./utils');
const setupDataSource = require('./setupDataSource');
const { uid } = require('@hkube/uid');

let restUrl;
/**
 * @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSource
 * @typedef {import('@hkube/db/lib/Snapshots').Snapshot} Snapshot
 */
describe('snapshots', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        DATASOURCE_GIT_REPOS_DIR = global.testParams.DATASOURCE_GIT_REPOS_DIR;
        STORAGE_DIR = global.testParams.STORAGE_DIR;
        restPath = `${restUrl}/datasource`;
    });
    describe('create', () => {
        /** @type */
        let dataSource = null;
        before(async () => {
            const { body: _dataSource } = await createDataSource({
                body: { name: uid() },
            });
            dataSource = _dataSource;
        });
        it('should create snapshot for the latest version by name', async () => {
            const snapshot = {
                name: 'my-snapshot-by-name',
                query: uid(),
            };
            const { body } = await createSnapshot({
                name: dataSource.name,
                snapshot,
            });
            expect(body.dataSource.name).to.eq(dataSource.name);
            expect(body.dataSource.id).to.eq(dataSource.id);
            expect(body.name).to.eq(snapshot.name);
            expect(body.query).to.eq(snapshot.query);
            expect(body).to.haveOwnProperty('id');
        });
        it('should create snapshot for a specified version', async () => {
            const snapshot = {
                name: 'my-snapshot-by-id',
                query: uid(),
            };
            const { body } = await createSnapshot({
                id: dataSource.id,
                snapshot,
            });
            expect(body.dataSource.name).to.eq(dataSource.name);
            expect(body.dataSource.id).to.eq(dataSource.id);
            expect(body.name).to.eq(snapshot.name);
            expect(body.query).to.eq(snapshot.query);
            expect(body).to.haveOwnProperty('id');
        });
    });
    describe('fetch', () => {
        /** @type {DataSource} */
        let dataSource = null;
        /** @type {Snapshot[]} */
        let generatedSnapshots = null;
        /** @type {Snapshot[]} */
        let createdSnapshots = null;
        const SNAPSHOTS_COUNT = 5;
        before(async () => {
            const {
                dataSource: _dataSource,
                generatedSnapshots: _generatedSnapshots,
                createdSnapshots: _createdSnapshots,
            } = await setupDataSource(SNAPSHOTS_COUNT);
            dataSource = _dataSource;
            generatedSnapshots = _generatedSnapshots;
            createdSnapshots = _createdSnapshots;
        });
        it('should fetch all snapshots for a given dataSource', async () => {
            const response = await fetchAllSnapshots({
                dataSourceName: dataSource.name,
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
            const randomSnapshot =
                createdSnapshots[Math.floor(Math.random() * SNAPSHOTS_COUNT)];
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
        it('should resolve a snapshot', async () => {
            const randomSnapshot =
                createdSnapshots[Math.floor(Math.random() * SNAPSHOTS_COUNT)];
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
            const response = await fetchSnapshot({
                dataSourceName: dataSource.name,
                snapshotName: 'non-existing-snapshot',
            });
            expect(response.body).to.haveOwnProperty('error');
            expect(response.body.error.code).to.eql(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.match(/not found/i);
        });
        it('should throw an error for an already occupied snapshot name', async () => {
            const [snapshot] = createdSnapshots;
            const response = await createSnapshot({
                id: dataSource.id,
                snapshot: {
                    name: snapshot.name,
                    query: snapshot.query,
                },
            });
            expect(response.body.error.code).to.eq(HttpStatus.CONFLICT);
            expect(response.body.error.message).to.match(/already exists/i);
        });
    });
    describe('filtering files', () => {
        it('should create a file and mark files to keep and files to drop', async () => {
            const name = uid();
            const dataSource = await createDataSource({
                body: { name },
                fileNames: ['algorithms.json', 'logo.svg', 'logo.svg.meta'],
            });
            const snapshot = await createSnapshot({
                name: dataSource.body.name,
                snapshot: { name: 'with-query', query: 'exciting information' },
            });
            const {
                body: { filteredFilesList, droppedFiles },
            } = snapshot;
            expect(filteredFilesList).to.have.lengthOf(1);
            expect(droppedFiles).to.have.lengthOf(1);
            expect(filteredFilesList[0].name).to.eq('logo.svg');
            expect(droppedFiles[0].name).to.eq('algorithms.json');
        });
    });
});
