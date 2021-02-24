const { expect } = require('chai');
const fse = require('fs-extra');
const { StatusCodes } = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const { hiddenProperties } = require('./utils');
const { mockDeleteClone } = require('./utils');
const { createDataSource, fetchDataSource, updateVersion } = require('./api');
const sortBy = require('lodash.sortby');

let DATASOURCE_GIT_REPOS_DIR;
describe('/datasource/:name POST', () => {
    before(() => {
        // @ts-ignore
        DATASOURCE_GIT_REPOS_DIR = global.testParams.DATASOURCE_GIT_REPOS_DIR;
        // @ts-ignore
        STORAGE_DIR = global.testParams.STORAGE_DIR;
    });
    it('should throw missing filesAdded, filesDropped and mapping error', async () => {
        const name = uuid();
        await createDataSource({ body: { name } });
        const { response: uploadResponse } = await updateVersion({
            dataSourceName: name,
        });
        expect(uploadResponse.body).to.have.property('error');
        const { error } = uploadResponse.body;
        expect(error.message).to.match(/provide at least one of/i);
        expect(error.code).to.eq(StatusCodes.BAD_REQUEST);
    });
    it('should fail uploading a file to a non existing dataSource', async () => {
        const { response: uploadResponse } = await updateVersion({
            dataSourceName: 'non-existing',
            fileNames: ['README-2.md'],
        });
        expect(uploadResponse.body).to.have.property('error');
        expect(uploadResponse.body.error.message).to.match(/not found/i);
        expect(uploadResponse.statusCode).to.eql(StatusCodes.NOT_FOUND);
    });
    it('should upload a new file to the dataSource and get a new version', async () => {
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
        hiddenProperties.forEach(prop => {
            expect(updatedVersion).not.to.haveOwnProperty(prop);
        });
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
        expect(uploadResponse.statusCode).to.eql(StatusCodes.CREATED);
    });
    it('should upload multiple files to the dataSource', async () => {
        const name = uuid();
        await createDataSource({ body: { name } });
        mockDeleteClone();
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
        const results = await Promise.all(
            [
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/someSubDir/README-2.md`,
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/someSubDir/README-2.md.dvc`,
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/algorithms.json`,
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/algorithms.json.dvc`,
            ].map(fse.pathExists)
        );
        results.forEach(r => expect(r).to.be.true);
        const { body: dataSource } = await fetchDataSource({ name });
        expect(dataSource.files).to.have.lengthOf(3);
        const sortedFiles = sortBy(
            dataSource.files.map(item => ({
                path: item.path,
                name: item.name,
            })),
            'name'
        );
        expect(sortedFiles).to.eql([
            { path: '/', name: 'README-1.md' },
            { path: '/someSubDir', name: 'README-2.md' },
            { path: '/', name: 'algorithms.json' },
        ]);
        expect(uploadResponse.statusCode).to.eql(StatusCodes.CREATED);
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
    });
    it('delete a file', async () => {
        const name = uuid();
        const { body: dataSource } = await createDataSource({
            body: { name },
        });
        const [existingFile] = dataSource.files;
        const { body: updatedVersion } = await updateVersion({
            dataSourceName: name,
            fileNames: ['algorithms.json'],
            droppedFileIds: [existingFile.id],
        });
        expect(updatedVersion.files).to.have.lengthOf(1);
        expect(updatedVersion.files[0].name).to.eq('algorithms.json');
    });
    it('should return status 200 if nothing was updated', async () => {
        const name = uuid();
        const { body: dataSource } = await createDataSource({
            body: { name },
        });
        const [existingFile] = dataSource.files;
        const uploadResponse = await updateVersion({
            dataSourceName: name,
            fileNames: [existingFile.name],
            mapping: [existingFile],
        });
        expect(uploadResponse.response.statusCode).to.eq(StatusCodes.OK);
    });
    describe('update a file', () => {
        it('github', async () => {
            const name = uuid();
            const {
                body: dataSource,
                response: { statusCode },
            } = await createDataSource({
                body: { name },
            });
            expect(statusCode).to.eq(201);
            const [existingFile] = dataSource.files;
            expect(existingFile.size).to.eq(107);

            const uploadResponse = await updateVersion({
                dataSourceName: name,
                fileNames: ['updatedVersions/README-1.md'],
                mapping: [existingFile],
            });
            const { body: updatedDataSource } = uploadResponse;

            expect(dataSource.commitHash).not.to.eq(
                updatedDataSource.commitHash
            );
            expect(dataSource.files.length).to.eq(
                updatedDataSource.files.length
            );

            const [updatedFile] = updatedDataSource.files;
            expect(updatedFile.id).not.to.eq(existingFile.id);
            expect(updatedFile.size).to.eq(131);
        });
        it('internal', async () => {
            const name = uuid();
            const {
                body: dataSource,
                response: { statusCode },
            } = await createDataSource({
                body: { name },
                useInternalGit: true,
                useInternalStorage: true,
            });
            expect(statusCode).to.eq(201);
            const [existingFile] = dataSource.files;
            expect(existingFile.size).to.eq(107);

            const uploadResponse = await updateVersion({
                dataSourceName: name,
                fileNames: ['updatedVersions/README-1.md'],
                mapping: [existingFile],
            });
            const { body: updatedDataSource } = uploadResponse;

            expect(dataSource.commitHash).not.to.eq(
                updatedDataSource.commitHash
            );
            expect(dataSource.files.length).to.eq(
                updatedDataSource.files.length
            );

            const [updatedFile] = updatedDataSource.files;
            expect(updatedFile.id).not.to.eq(existingFile.id);
            expect(updatedFile.size).to.eq(131);
        });
        it.skip('gitlab', async () => {
            const name = uuid();
            const {
                body: dataSource,
                response: { statusCode },
            } = await createDataSource({
                body: { name },
                useGitlab: true,
                useInternalStorage: true,
            });
            expect(statusCode).to.eq(201);
            const [existingFile] = dataSource.files;
            expect(existingFile.size).to.eq(107);

            const uploadResponse = await updateVersion({
                dataSourceName: name,
                fileNames: ['updatedVersions/README-1.md'],
                mapping: [existingFile],
            });
            const { body: updatedDataSource } = uploadResponse;

            expect(dataSource.commitHash).not.to.eq(
                updatedDataSource.commitHash
            );
            expect(dataSource.files.length).to.eq(
                updatedDataSource.files.length
            );

            const [updatedFile] = updatedDataSource.files;
            expect(updatedFile.id).not.to.eq(existingFile.id);
            expect(updatedFile.size).to.eq(131);
        });
    });
    it('should upload a file with spaces in its name', async () => {
        const name = uuid();
        await createDataSource({
            body: { name },
        });

        const fileNames = ['algorithm spaces.json', 'algorithms.json'];

        mockDeleteClone();
        const { body: dataSource } = await updateVersion({
            dataSourceName: name,
            fileNames,
        });
        expect(
            dataSource.files.find(file => file.name === 'algorithm spaces.json')
        ).not.to.be.undefined;
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
        expect(files).to.have.lengthOf(3);
        const logoFile = files.find(file => file.name === 'logo.svg');
        expect(logoFile.meta).to.match(/information about the logo/i);
        expect(logoFile.path).to.eq('/new-dir');
        const metaFile = files.find(file => file.name === 'logo.svg.meta');
        expect(metaFile).to.be.undefined;
    });
});
