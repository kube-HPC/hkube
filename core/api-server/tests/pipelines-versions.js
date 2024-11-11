const { expect } = require('chai');
const clone = require('clone');
const { uid: uuid } = require('@hkube/uid');
const { pipelines } = require('./mocks');
const { request } = require('./utils');
const stateManager = require('../lib/state/state-manager');
let restUrl, restPath;


describe('Versions/Pipelines', () => {
    const pipeline = clone(pipelines[0]);

    const addPipeline = async (pipeline) => {
        const name = `pipe-test-${uuid()}`;
        await stateManager.deletePipeline({ name, keepOldVersions: false })
        const addRequest = { uri: `${restUrl}/store/pipelines`, method: 'POST', body: pipeline };
        pipeline.name = name;
        const res = await request(addRequest);
        return { name, version: res.body.version };
    }

    const updatePipeline = async (pipeline) => {
        const updateRequest = { uri: `${restUrl}/store/pipelines`, method: 'PUT', body: pipeline };
        await request(updateRequest);
    }

    const getAllVersions = async (name) => {
        const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
        const res = await request(versionReq);
        return res.body;
    }

    const getSpecificVersion = async (name, version) => {
        const versionReq = { uri: `${restPath}/${name}/${version}`, method: 'GET' };
        const res = await request(versionReq);
        return res.body.version;
    }

    before(() => {
        restUrl = global.testParams.restUrl;
        restPath = `${restUrl}/versions/pipelines`;
    });

    describe('get', () => {
        it('should succeed to get list of the new pipeline version', async () => {
            const { name } = await addPipeline(pipeline);
            const versionsList = await getAllVersions(name);
            expect(versionsList).to.have.lengthOf(1);
        });

        it('should succeed to get version', async () => {
            const { name, version } = await addPipeline(pipeline);
            const specificVersion = await getSpecificVersion(name, version);
            expect(specificVersion).to.eql(version);
        });
        
        it('should succeed to get versions', async () => {
            const { name } = await addPipeline(pipeline);
            const pipeline2 = clone(pipeline);
            pipeline2.options.ttl = 6666;
            await updatePipeline(pipeline2);
            const versionsList = await getAllVersions(name)
            const semver = versionsList.map((v) => v.semver);
            expect(versionsList).to.have.lengthOf(2);
            expect(semver).to.eql(['1.0.1', '1.0.0']);
        });
    });

    describe('versions when pipeline is deleted', () => {
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
