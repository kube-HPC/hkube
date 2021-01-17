const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { requestValidation, nonExistingId } = require('./utils');
const setupDataSource = require('./setupDataSource');

let restUrl;
/** @type {import('@hkube/db/lib/DataSource').DataSource} */
let dataSource;
/** @type {import('@hkube/db/lib/Snapshots').Snapshot[]} */
let createdSnapshots;

describe.only('validation', () => {
    before(async () => {
        restUrl = global.testParams.restUrl;
        DATASOURCE_GIT_REPOS_DIR = global.testParams.DATASOURCE_GIT_REPOS_DIR;
        STORAGE_DIR = global.testParams.STORAGE_DIR;
        restPath = `${restUrl}/datasource`;
        const {
            dataSource: _dataSource,
            createdSnapshots: _createdSnapshots,
        } = await setupDataSource();
        dataSource = _dataSource;
        createdSnapshots = _createdSnapshots;
    });

    it('should validate dataSource by name only', async () => {
        const { response } = await requestValidation({
            dataSourceName: dataSource.name,
        });
        expect(response.statusCode).to.eq(HttpStatus.OK);
        expect(response.body).to.eql({ exists: true });
    });
    it('should validate dataSource by version', async () => {
        const { response } = await requestValidation({
            versionId: dataSource.id,
        });
        expect(response.statusCode).to.eq(HttpStatus.OK);
        expect(response.body).to.eql({ exists: true });
    });
    it('should validate dataSource by name and snapshot', async () => {
        const [snapshot] = createdSnapshots;
        const { response } = await requestValidation({
            dataSourceName: dataSource.name,
            snapshotName: snapshot.name,
        });
        expect(response.statusCode).to.eq(HttpStatus.OK);
        expect(response.body).to.eql({ exists: true });
    });
    it('should fail for sending both snapshot and version', async () => {
        const [snapshot] = createdSnapshots;
        const { response } = await requestValidation({
            versionId: dataSource.id,
            snapshotName: snapshot.name,
        });
        expect(response.statusCode).to.eq(HttpStatus.BAD_REQUEST);
        expect(response.body.error.message).to.eql(
            'you must provide *only* one of (version_id | snapshot_name)'
        );
    });
    it('should fail with non existing name', async () => {
        const { response } = await requestValidation({
            dataSourceName: 'non-existing',
        });
        expect(response.statusCode).to.eq(HttpStatus.NOT_FOUND);
    });
    it('should fail with non existing version', async () => {
        const { response } = await requestValidation({
            versionId: nonExistingId,
        });
        expect(response.statusCode).to.eq(HttpStatus.NOT_FOUND);
    });
    it('should fail with non existing snapshot', async () => {
        const { response } = await requestValidation({
            dataSourceName: dataSource.name,
            snapshotName: 'nope----------------nope',
        });
        expect(response.body.error.code).to.eq(HttpStatus.NOT_FOUND);
    });
    it('should fail with snapshot name and no datasource name', async () => {
        const [snapshot] = createdSnapshots;
        const { response } = await requestValidation({
            snapshotName: snapshot.name,
        });
        expect(response.statusCode).to.eq(HttpStatus.BAD_REQUEST);
        expect(response.body.error.message).to.match(
            /you must provide datasource_name/
        );
    });
});
