const { expect } = require('chai');
const clone = require('clone');
const { uid: uuid } = require('@hkube/uid');
const { pipelines } = require('./mocks');
const { request } = require('./utils');
const stateManager = require('../lib/state/state-manager');
const HttpStatus = require('http-status-codes');


describe.only('Versions/Pipelines', () => {
    let pipeline;
    let restUrl, restPath;
    beforeEach (() => {
        pipeline = clone(pipelines[0]);
    });

    before(() => {
        restUrl = global.testParams.restUrl;
        restPath = `${restUrl}/versions/pipelines`;
    });

    const addPipeline = async (pipeline) => {
        const name = `pipe-test-${uuid()}`;
        await stateManager.deletePipeline({ name, keepOldVersions: false })
        pipeline.name = name;
        const addRequest = { uri: `${restUrl}/store/pipelines`, method: 'POST', body: pipeline };
        const res = await request(addRequest);
        return res.body;
    }

    const updatePipeline = async (pipeline) => {
        const updateRequest = { uri: `${restUrl}/store/pipelines`, method: 'PUT', body: pipeline };
        const res = await request(updateRequest);
        return res.body.version;
    }

    const getPipelineCurrentVersion = async (name) => {
        const getRequest = { uri: `${restUrl}/store/pipelines/${name}`, method: 'GET' };
        const res = await request(getRequest);
        return res.body.version;
    }

    const getAllVersions = async (name) => {
        const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
        const res = await request(versionReq);
        return res.body;
    }

    const getSpecificVersion = async (name, version) => {
        const versionReq = { uri: `${restPath}/${name}/${version}`, method: 'GET' };
        const res = await request(versionReq);
        return res.body;
    }

    const updatePipelineVersion = async (name, version) => {
        const updateRequest = { uri: `${restPath}/apply`, method: 'POST', body: { name, version, force: true } };
        const res = await request(updateRequest);
        return res.body;
    }

    describe('get methods', () => {
        describe('getVersions method', () => {
            it('should succeed to get list of the new pipeline version', async () => {
                const { name, version: oldVersion } = await addPipeline(pipeline);
                const versionsList1 = await getAllVersions(name);
                expect(versionsList1).to.have.lengthOf(1);

                pipeline.priority = 2;
                const newVersion = await updatePipeline(pipeline);
                expect(newVersion).to.not.equal(oldVersion);

                const versionsList2 = await getAllVersions(name);
                expect(versionsList2).to.have.lengthOf(2);
            });

            it('should return empty versions list for pipeline name which doesnt exist', async () => {
                const versions = await getAllVersions('non-exist');
                expect(versions).to.be.an('array').that.is.empty;
            });
        });

        describe('getVersion method', () => {
            it('should succeed to get version', async () => {
                const { name, version } = await addPipeline(pipeline);
                const { version: specificVersion } = await getSpecificVersion(name, version);
                expect(specificVersion).to.eql(version);
            });

            it('should throw ResourceNotFoundError if pipeline is not found', async () => {
                const { error } = await getSpecificVersion('non-exist', '6');
                expect(error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
                expect(error.message).to.equal('pipeline non-exist Not Found');
            });

            it('should throw ResourceNotFoundError if version is not found', async () => {
                const { name } = await addPipeline(pipeline);
                const { error } = await getSpecificVersion(name, '6');
                expect(error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
                expect(error.message).to.equal('version 6 Not Found');
            });
        });
    });

    describe('update methods', () => {
        describe('updating the pipeline itself', () => {
            it('should succeed to get versions and change version to latest, plus change semver', async () => {
                const { name, version: oldVersion } = await addPipeline(pipeline);
                pipeline.options.ttl = 6666;
                const newVersion = await updatePipeline(pipeline);
                const versionsList = await getAllVersions(name)
                const semver = versionsList.map((v) => v.semver);

                expect(versionsList).to.have.lengthOf(2);
                expect(semver).to.eql(['1.0.1', '1.0.0']);
                expect(oldVersion).to.be.not.equal(newVersion);
                expect(newVersion).to.be.equal(versionsList[0].version);
                expect(versionsList[0].semver).to.be.equal('1.0.1');
            });

            it('should not change version if the same pipeline has been inserted, without any update', async () => {
                const addedPipeline = await addPipeline(pipeline);
                const { name, version } = addedPipeline;
                const versionAfterUpdate = await updatePipeline(addedPipeline);
                const versionsList = await getAllVersions(name);
                const semver = versionsList.map((v) => v.semver);

                expect(versionsList).to.have.lengthOf(1);
                expect(semver).to.eql(['1.0.0']);
                expect(version).to.eql(versionAfterUpdate);
                expect(version).to.be.equal(versionsList[0].version);
            });
        });

        describe('applying pipeline version (change to other version)', () => {
            it('should succeed to apply version', async () => {
                const { name, version: version1 } = await addPipeline(pipeline);
                pipeline.priority = 2;
                const version2 = await updatePipeline(pipeline);
                const currentVersion2 = await getPipelineCurrentVersion(name);
                expect(version1).to.not.equal(version2);
                expect(version2).to.equal(currentVersion2);

                await updatePipelineVersion(name, version1);
                const currentVersion1 = await getPipelineCurrentVersion(name);

                expect(currentVersion1).to.equal(version1);
            });

            it('should throw ResourceNotFoundError if pipeline is not found', async () => {
                const { error } = await updatePipelineVersion('non-exist', '6');
                expect(error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
                expect(error.message).to.equal('pipeline non-exist Not Found');
            });

            it('should throw ResourceNotFoundError if version is not found', async () => {
                const { name } = await addPipeline(pipeline);
                const { error } = await updatePipelineVersion(name, '6');
                expect(error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
                expect(error.message).to.equal('version 6 Not Found');
            });
        });
    });

    describe('versions handling when pipeline is deleted', () => {
        it('should return empty list after pipeline deleted', async () => {
            const { name } = await addPipeline(pipeline);
            await stateManager.deletePipeline({ name, keepOldVersions: false });
            const versionsList = await getAllVersions(name);
            expect(versionsList).to.have.lengthOf(0);
        });

        it('should return the versions of the deleted pipeline', async () => {
            const { name } = await addPipeline(pipeline);
            await stateManager.deletePipeline({ name, keepOldVersions: true });
            const versionsList = await getAllVersions(name);
            expect(versionsList).to.have.lengthOf(1);
        });
    });
});
