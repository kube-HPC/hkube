const { expect } = require('chai');
const { StatusCodes } = require('http-status-codes');
const clone = require('clone');
const { pipelineStatuses, nodeKind } = require('@hkube/consts');
const { uid: uuid } = require('@hkube/uid');
const { pipelines: [pipeline] } = require('./mocks');
const { request } = require('./utils');
const stateManager = require('../lib/state/state-manager');
let restUrl, restPath;

describe.only('Versions/Pipelines', () => {
    const pipeList = [];

    const addPipeline = async (pipeline) => {
        const name = `pipe-test-${uuid()}`;
        await stateManager.deletePipeline({ name, keepOldVersions: false })
        const addRequest = { uri: `${restUrl}/store/pipelines`, method: 'POST', body: pipeline };
        pipeline.name = name;
        const res = await request(addRequest);
        pipeList.push(name);
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

    beforeEach(function () {
        console.log('\n-----------------------------------------------\n');
    });

    after(async function () {
        this.timeout(2 * 60 * 1000);
        console.log("pipeList = " + pipeList);
        j = 0;
        z = 3;

        while (j < pipeList.length) {
            delPipe = pipeList.slice(j, z);
            const del = delPipe.map((e) => {
                return stateManager.deletePipelines(delPipe);
            })
            console.log("delPipe-", JSON.stringify(delPipe, null, 2));
            const delResult = await Promise.all(del);
            delResult.forEach(result => {
                if (result && result.text) {
                    console.log("Delete Result Message:", result.text);
                }
            });
            j += 3;
            z += 3;
            console.log("j=" + j + ",z=" + z);
        }
        console.log("----------------------- end -----------------------");
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

    describe.skip('versions when pipeline is deleted', () => {
        it('should return empty list after pipeline deleted', async () => {
            const { name } = await addPipeline(pipeline);
            await stateManager.deletePipeline({ name, keepOldVersions: false });
            
        })
    });
});
