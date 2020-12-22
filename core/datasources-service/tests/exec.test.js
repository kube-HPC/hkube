const { expect } = require('chai');
const { uid: uuid } = require('@hkube/uid');
const { request } = require('./request');
const { createDataSource, updateVersion, fileName } = require('./utils');

let restUrl;

describe.skip('/datasource/exec/raw', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        DATASOURCE_GIT_REPOS_DIR = global.testParams.DATASOURCE_GIT_REPOS_DIR;
        STORAGE_DIR = global.testParams.STORAGE_DIR;
        restPath = `${restUrl}/datasource`;
    });
    it('should throw missing file error', async () => {
        const dataSourceName = uuid();
        const ds = `dataSource.${dataSourceName}/${fileName}`;
        await createDataSource({ body: { name: dataSourceName } });
        const pipeline = {
            name: uuid(),
            nodes: [
                {
                    nodeName: 'node1',
                    algorithmName: 'green-alg',
                    input: [`@${ds}/non-existing-file.txt`],
                },
            ],
        };
        const res = await request({
            uri: `${restUrl}/exec/raw`,
            body: pipeline,
        });
        const { error } = res.body;
        expect(error).to.haveOwnProperty('message');
        expect(error.message).to.match(/not found/i);
    });
    it('should succeed and return job id', async () => {
        const dataSourceName = uuid();
        const ds = `dataSource.${dataSourceName}/${fileName}`;
        await createDataSource({ body: { name: dataSourceName } });
        await updateVersion({
            dataSourceName,
            fileNames: [fileName],
            versionDescription: 'my testing version',
        });
        const pipeline = {
            name: uuid(),
            nodes: [
                {
                    nodeName: 'node1',
                    algorithmName: 'green-alg',
                    input: [`@${ds}`],
                },
            ],
        };
        const res = await request({
            uri: `${restUrl}/exec/raw`,
            body: pipeline,
        });
        console.log(res.body);
        const response = await request({
            method: 'GET',
            uri: `${restUrl}/exec/pipelines/${res.body.jobId}`,
        });
        expect(response.body.dataSourceMetadata).to.have.property(ds);
    });
});
