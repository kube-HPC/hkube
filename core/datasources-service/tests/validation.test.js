const { expect } = require('chai');
const { StatusCodes } = require('http-status-codes');
const { nonExistingId } = require('./utils');
const { requestValidation } = require('./api');
const setupDataSource = require('./setupDataSource');

/** @type {import('@hkube/db/lib/DataSource').DataSource} */
let dataSource;
/** @type {import('@hkube/db/lib/Snapshots').Snapshot[]} */
let createdSnapshots;

describe('validation', () => {
    before(async () => {
        // @ts-ignore
        DATASOURCE_GIT_REPOS_DIR = global.testParams.DATASOURCE_GIT_REPOS_DIR;
        // @ts-ignore
        STORAGE_DIR = global.testParams.STORAGE_DIR;
        const {
            dataSource: _dataSource,
            createdSnapshots: _createdSnapshots,
        } = await setupDataSource();
        dataSource = _dataSource;
        createdSnapshots = _createdSnapshots;
    });

    it('should validate dataSource by name only', async () => {
        const { response } = await requestValidation({
            name: dataSource.name,
        });
        expect(response.statusCode).to.eq(StatusCodes.OK);
        expect(response.body).to.eql({ exists: true, id: dataSource.id });
    });
    it('should validate dataSource by version', async () => {
        const { response } = await requestValidation({
            id: dataSource.id,
        });
        expect(response.statusCode).to.eq(StatusCodes.OK);
        expect(response.body).to.eql({ exists: true, id: dataSource.id });
    });
    it('should validate dataSource by name and snapshot', async () => {
        const [snapshot] = createdSnapshots;
        const { response } = await requestValidation({
            name: dataSource.name,
            snapshotName: snapshot.name,
        });
        expect(response.statusCode).to.eq(StatusCodes.OK);
        expect(response.body).to.eql({ exists: true, id: snapshot.id });
    });
    it('should fail for sending both snapshot and version', async () => {
        const [snapshot] = createdSnapshots;
        const { response } = await requestValidation({
            id: dataSource.id,
            snapshotName: snapshot.name,
        });
        expect(response.statusCode).to.eq(StatusCodes.BAD_REQUEST);
        expect(response.body.error.message).to.eql(
            'must provide *only* one of (id | snapshot.name)'
        );
    });
    it('should fail with non existing name', async () => {
        const { response } = await requestValidation({
            name: 'non-existing',
        });
        expect(response.statusCode).to.eq(StatusCodes.NOT_FOUND);
    });
    it('should fail with non existing version', async () => {
        const { response } = await requestValidation({
            id: nonExistingId,
        });
        expect(response.statusCode).to.eq(StatusCodes.NOT_FOUND);
    });
    it('should fail with non existing snapshot', async () => {
        const { response } = await requestValidation({
            name: dataSource.name,
            snapshotName: 'nope----------------nope',
        });
        expect(response.body.error.code).to.eq(StatusCodes.NOT_FOUND);
    });
    it('should fail with snapshot name and no datasource name', async () => {
        const [snapshot] = createdSnapshots;
        const { response } = await requestValidation({
            snapshotName: snapshot.name,
        });
        expect(response.statusCode).to.eq(StatusCodes.BAD_REQUEST);
        expect(response.body.error.message).to.match(
            /must provide "name" when/i
        );
    });
});
