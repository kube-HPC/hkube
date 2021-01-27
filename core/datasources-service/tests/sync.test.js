const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const { syncDataSource, createDataSource } = require('./utils');

describe('sync', () => {
    describe('validation', () => {
        it('should fail on non existing datasource', async () => {
            const { response } = await syncDataSource({
                name: 'non-existing',
            });
            expect(response.statusCode).to.eq(HttpStatus.NOT_FOUND);
        });
    });

    it('should create an updated version', async () => {
        const name = uuid();
        const { body: dataSource } = await createDataSource({ body: { name } });
        const { body: updated, response } = await syncDataSource({
            name: dataSource.name,
        });
        expect(response.statusCode).to.eq(HttpStatus.CREATED);
        expect(dataSource.commitHash).to.eq(updated.commitHash);
        expect(dataSource.id).not.to.eq(updated.id);
    });
});
