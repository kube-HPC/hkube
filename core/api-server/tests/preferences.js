const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');

const USER_ID_HEADER = 'x-hkube-user-id';

let restUrl, preferencesPath;

const samplePreferences = {
    theme: 'dark',
    scoopIntervalHours: 24,
    tables: {
        jobs: {
            columns: {
                name: { visible: true, width: 200 },
                status: { visible: false, width: 120 }
            }
        },
        algorithms: { columns: {} },
        pipelines: { columns: {} }
    }
};

describe('Preferences', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        preferencesPath = `${restUrl}/preferences`;
    });

    describe('GET /preferences', () => {
        it('should return empty object for new user', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'GET',
                headers: { [USER_ID_HEADER]: 'device-new-user-test' }
            });
            expect(response.body).to.eql({});
        });

        it('should return 400 when no user identification is provided', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'GET'
            });
            expect(response.body).to.have.property('error');
        });
    });

    describe('PUT /preferences', () => {
        it('should create preferences and return saved object', async () => {
            const userId = 'device-put-test-1';
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: samplePreferences
            });
            expect(response.body.theme).to.equal('dark');
            expect(response.body.scoopIntervalHours).to.equal(24);
            expect(response.body.tables).to.deep.equal(samplePreferences.tables);
        });

        it('should replace existing preferences (full replacement)', async () => {
            const userId = 'device-put-test-2';
            await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: samplePreferences
            });
            const updatedPrefs = {
                theme: 'light',
                scoopIntervalHours: 1,
                tables: {
                    jobs: { columns: {} },
                    algorithms: { columns: {} },
                    pipelines: { columns: {} }
                }
            };
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: updatedPrefs
            });
            expect(response.body.theme).to.equal('light');
            expect(response.body.scoopIntervalHours).to.equal(1);
            expect(response.body.tables.jobs.columns).to.deep.equal({});
        });

        it('should reject unknown fields with a validation error', async () => {
            const userId = 'device-put-stale-test';
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: { ...samplePreferences, extraField: 'should-be-rejected', hack: true }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('unknown preferences fields');
        });

        it('should reject invalid theme value', async () => {
            const userId = 'device-put-invalid-theme';
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: { theme: 'blue' }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('theme');
        });

        it('should reject invalid scoopIntervalHours value', async () => {
            const userId = 'device-put-invalid-scoop';
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: { scoopIntervalHours: 5 }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('scoopIntervalHours');
        });

        it('should reject invalid tables type', async () => {
            const userId = 'device-put-invalid-tables';
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: { tables: 'not-an-object' }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('tables');
        });

        it('should reject unknown table keys', async () => {
            const userId = 'device-put-unknown-table';
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: { tables: { unknownTable: { columns: {} } } }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('unknown tables keys');
        });

        it('should reject unknown column properties', async () => {
            const userId = 'device-put-unknown-col-prop';
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: { tables: { jobs: { columns: { name: { visible: true, color: 'red' } } } } }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('unknown column properties');
        });

        it('should reject non-boolean visible', async () => {
            const userId = 'device-put-bad-visible';
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: { tables: { jobs: { columns: { name: { visible: 'yes' } } } } }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('visible must be a boolean');
        });

        it('should reject non-positive-integer width', async () => {
            const userId = 'device-put-bad-width';
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: { tables: { jobs: { columns: { name: { width: -10 } } } } }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('width must be a positive integer');
        });
    });

    describe('GET /preferences (after PUT)', () => {
        it('should return previously saved preferences', async () => {
            const userId = 'device-get-after-put';
            await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: samplePreferences
            });
            const response = await request({
                uri: preferencesPath,
                method: 'GET',
                headers: { [USER_ID_HEADER]: userId }
            });
            expect(response.body.theme).to.equal('dark');
            expect(response.body.scoopIntervalHours).to.equal(24);
            expect(response.body.tables).to.deep.equal(samplePreferences.tables);
        });
    });

    describe('DELETE /preferences', () => {
        it('should remove preferences and return empty object', async () => {
            const userId = 'device-delete-test';
            await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userId },
                body: samplePreferences
            });
            const deleteResponse = await request({
                uri: preferencesPath,
                method: 'DELETE',
                headers: { [USER_ID_HEADER]: userId }
            });
            expect(deleteResponse.body).to.eql({});

            const getResponse = await request({
                uri: preferencesPath,
                method: 'GET',
                headers: { [USER_ID_HEADER]: userId }
            });
            expect(getResponse.body).to.eql({});
        });

        it('should be idempotent (no error when nothing to delete)', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'DELETE',
                headers: { [USER_ID_HEADER]: 'device-nonexistent-user' }
            });
            expect(response.body).to.eql({});
        });
    });

    describe('User isolation', () => {
        it('should keep preferences separate per userId', async () => {
            const userA = 'device-user-a';
            const userB = 'device-user-b';

            await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userA },
                body: { ...samplePreferences, theme: 'dark' }
            });
            await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: userB },
                body: { ...samplePreferences, theme: 'lightsOut' }
            });

            const responseA = await request({
                uri: preferencesPath,
                method: 'GET',
                headers: { [USER_ID_HEADER]: userA }
            });
            const responseB = await request({
                uri: preferencesPath,
                method: 'GET',
                headers: { [USER_ID_HEADER]: userB }
            });

            expect(responseA.body.theme).to.equal('dark');
            expect(responseB.body.theme).to.equal('lightsOut');
        });

        it('should return another user preferences via userId query param', async () => {
            const ownerUser = 'device-owner-user';
            const viewerUser = 'device-viewer-user';

            await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: { [USER_ID_HEADER]: ownerUser },
                body: { ...samplePreferences, theme: 'lightsOut' }
            });

            const response = await request({
                uri: `${preferencesPath}?userId=${ownerUser}`,
                method: 'GET',
                headers: { [USER_ID_HEADER]: viewerUser }
            });
            expect(response.body.theme).to.equal('lightsOut');
        });
    });
});
