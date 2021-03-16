const { expect } = require('chai');
const { StatusCodes } = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');

const { createDataSource, updateCredentials } = require('./api');

describe('update credentials', () => {
    describe('validation', () => {
        it('should fail on missing credentials field', async () => {
            let response;
            try {
                response = await updateCredentials({
                    name: 'non-existing',
                    ignoreCredentials: true,
                });
            } catch (error) {
                response = error;
            }
            expect(response.body).to.haveOwnProperty('error');
            expect(response.body.error.code).eq(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.match(
                /required property 'credentials'/
            );
        });
        it('should fail on non-existing dataSource', async () => {
            let response;
            try {
                response = await updateCredentials({
                    name: 'non-existing',
                    credentials: {
                        git: { token: 'irrelevant' },
                    },
                });
            } catch (error) {
                response = error;
            }
            expect(response.body).to.haveOwnProperty('error');
            expect(response.body.error.code).eq(StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.match(
                /non-existing not found/i
            );
        });
    });
    describe('update', () => {
        it('should update both git and storage and return the number of versions updated', async () => {
            const name = uuid();
            await createDataSource(name);
            const response = await updateCredentials({
                name,
                credentials: {
                    git: { token: 'new-token' },
                    storage: {
                        accessKeyId: 'new key id',
                        secretAccessKey: 'new secret access key',
                    },
                },
            });
            expect(response.body.updatedCount).to.eq(1);
        });
    });
});
