const { expect } = require('chai');
const fse = require('fs-extra');
const HttpStatus = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const { createDataSource, fetchDataSource, updateVersion } = require('./utils');

let DATASOURCE_GIT_REPOS_DIR;
describe('/datasource/:name POST', () => {
    before(() => {
        DATASOURCE_GIT_REPOS_DIR = global.testParams.DATASOURCE_GIT_REPOS_DIR;
        STORAGE_DIR = global.testParams.STORAGE_DIR;
    });
    // update after adding ajv validation on the service
    it.skip('should throw missing filesAdded and filesDropped error', async () => {
        const name = uuid();
        await createDataSource({ body: { name } });
        const { response: uploadResponse } = await updateVersion({
            dataSourceName: name,
        });
        expect(uploadResponse.body).to.have.property('error');
        expect(uploadResponse.body.error.message).to.match(
            /data should have required property '.filesAdded'/i
        );
        expect(uploadResponse.body.error.message).to.match(
            /data should have required property '.filesDropped'/i
        );
    });
    it('should fail uploading a file to a non existing dataSource', async () => {
        const { response: uploadResponse } = await updateVersion({
            dataSourceName: 'non-existing',
            fileNames: ['README-2.md'],
        });
        expect(uploadResponse.body).to.have.property('error');
        expect(uploadResponse.body.error.message).to.match(/not found/i);
        expect(uploadResponse.statusCode).to.eql(HttpStatus.NOT_FOUND);
    });
    // should pass
    it.skip('should upload a new file to the dataSource and get a new version', async () => {
        const name = uuid();
        const { body: firstVersion } = await createDataSource({
            body: { name },
        });
        const secondFileName = 'README-2.md';
        const { response: uploadResponse } = await updateVersion({
            dataSourceName: name,
            fileNames: [secondFileName],
        });
        const { body: updatedVersion } = uploadResponse;
        expect(firstVersion.id).not.to.eq(updatedVersion.id);
        expect(firstVersion.name).to.eq(updatedVersion.name);
        const { files } = updatedVersion;
        expect(files).to.have.lengthOf(2);
        files.forEach(file => {
            expect(file).to.have.property('name');
            expect(file).to.have.property('path');
            expect(file).to.have.property('size');
            expect(file).to.have.property('type');
        });
        const { response: fetchDataSourceResponse } = await fetchDataSource({
            name,
        });
        const { body: dataSource } = fetchDataSourceResponse;
        expect(dataSource.files).to.have.lengthOf(2);
        expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
    });
    it('should upload multiple files to the dataSource', async () => {
        const name = uuid();
        await createDataSource({ body: { name } });
        const { response: uploadResponse } = await updateVersion({
            dataSourceName: name,
            files: [
                { name: 'algorithms.json', id: uuid() },
                { name: 'README-2.md', id: 'someID' },
            ],
            mapping: [
                { id: 'someID', name: 'README-2.md', path: '/someSubDir' },
            ],
        });
        const {
            body: { files },
        } = uploadResponse;
        files.forEach(file => {
            expect(file).to.have.property('name');
            expect(file).to.have.property('path');
        });
        const mappedFile = files.find(file => file.name === 'README-2.md');
        expect(mappedFile.path).to.eq('/someSubDir');
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/someSubDir/README-2.md`
            )
        );
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/someSubDir/README-2.md.dvc`
            )
        );
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/algorithms.json`
            )
        );
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/algorithms.json.dvc`
            )
        );
        const { response: fetchDataSourceResponse } = await fetchDataSource({
            name,
        });
        const { body: dataSource } = fetchDataSourceResponse;
        expect(dataSource.files).to.have.lengthOf(3);
        expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
    });
    it('should move a file', async () => {
        const name = uuid();
        const { body: dataSource } = await createDataSource({
            body: { name },
        });
        const [existingFile] = dataSource.files;
        const { response: uploadResponse } = await updateVersion({
            dataSourceName: name,
            files: [
                { name: 'algorithms.json', id: uuid() },
                { name: 'README-2.md', id: 'someID' },
            ],
            mapping: [
                { id: 'someID', name: 'README-2.md', path: '/someSubDir' },
                {
                    id: existingFile.id,
                    name: existingFile.name,
                    path: '/a new directory',
                },
            ],
        });
        const {
            body: { files },
        } = uploadResponse;
        const updatedFile = files.find(file => file.id === existingFile.id);
        expect(updatedFile).to.exist;
        expect(updatedFile.path).to.equal('/a-new-directory');
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/a-new-directory/${existingFile.name}`
            )
        );
    });
    it('delete a file', async () => {
        const name = uuid();
        const { body: dataSource } = await createDataSource({
            body: { name },
        });
        const [existingFile] = dataSource.files;
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}.dvc`
            )
        ).to.be.true;

        await updateVersion({
            dataSourceName: name,
            fileNames: ['algorithms.json'],
            droppedFileIds: [existingFile.id],
        });
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/algorithms.json`
            )
        ).to.be.true;
        // the data file is not deleted only the .dvc file
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}`
            )
        ).to.be.false;
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}.dvc`
            )
        ).to.be.false;
    });
    it('should return status 200 if nothing was updated', async () => {
        const name = uuid();
        const { body: dataSource } = await createDataSource({
            body: { name },
        });
        const [existingFile] = dataSource.files;
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}.dvc`
            )
        ).to.be.true;
        const uploadResponse = await updateVersion({
            dataSourceName: name,
            fileNames: [existingFile.name],
            mapping: [existingFile],
        });
        expect(uploadResponse.response.statusCode).to.eq(HttpStatus.OK);
    }).timeout(15000);
    it('should update a file', async () => {
        const name = uuid();
        const { body: dataSource } = await createDataSource({
            body: { name },
        });
        const [existingFile] = dataSource.files;
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}.dvc`
            )
        ).to.be.true;
        expect(
            await fse.statSync(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}`
            ).size
        ).to.eq(107);
        const uploadResponse = await updateVersion({
            dataSourceName: name,
            fileNames: ['updatedVersions/README-1.md'],
            mapping: [existingFile],
        });
        const { body: uploadResponseBody } = uploadResponse;
        // the data file is not deleted only the .dvc file
        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}`
            )
        ).to.be.true;
        expect(
            await fse.statSync(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}`
            ).size
        ).to.eq(131);
        expect(dataSource.versionId).not.to.eq(uploadResponseBody.versionId);
        expect(dataSource.files.length).to.eq(uploadResponseBody.files.length);
        expect(uploadResponseBody.files[0].size).to.eq(131);
    });
    it("should upload a file with spaces in it's name", async () => {
        const name = uuid();
        await createDataSource({
            body: { name },
        });
        const fileNames = ['algorithm spaces.json', 'algorithms.json'];

        await updateVersion({
            dataSourceName: name,
            fileNames,
        });
        // the data file is not deleted only the .dvc file
        fileNames.forEach(async fileName => {
            const hasFiles = await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${fileName}`
            );
            expect(hasFiles).to.be.true;
        });
    });
    it('should upload a file with meta data to a sub-dir', async () => {
        const name = uuid();
        await createDataSource({
            body: { name },
        });
        const uploadResponse = await updateVersion({
            dataSourceName: name,
            files: [
                { name: 'README-2.md', id: 'someId' },
                { name: 'logo.svg', id: 'logoId' },
                { name: 'logo.svg.meta', id: 'logoMetaId' },
            ],
            mapping: [
                {
                    id: 'someId',
                    name: 'README-2.md',
                    path: '/someSubDir',
                },
                { id: 'logoId', name: 'logo.svg', path: '/new-dir' },
                {
                    id: 'logoMetaId',
                    name: 'logo.svg.meta',
                    path: '/new-dir',
                },
            ],
        });

        const {
            body: { files },
        } = uploadResponse;
        const logoFile = files.find(file => file.name === 'logo.svg');
        expect(logoFile.meta).to.match(/information about the logo/i);

        const existingFiles = await Promise.all(
            [
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/someSubDir/README-2.md`,
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/new-dir/logo.svg`,
            ].map(address => fse.pathExists(address))
        );
        existingFiles.forEach(isExisting => {
            expect(isExisting).to.be.true;
        });

        expect(
            await fse.pathExists(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/new-dir/logo.svg.meta`
            )
        ).to.be.true;
    });
}).timeout(20000);
