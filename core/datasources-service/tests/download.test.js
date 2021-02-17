const { expect } = require('chai');
const fse = require('fs-extra');
const { StatusCodes } = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const sinon = require('sinon');
const {
    createDataSource,
    updateVersion,
    createDownloadLink,
    fetchDownloadLink,
} = require('./api');

let ZIP_DIRECTORY;

describe('download', () => {
    before(() => {
        // @ts-ignore
        ZIP_DIRECTORY = global.testParams.directories.zipFiles;
    });
    describe('validation', () => {
        it('should fail too long downloadId', async () => {
            const {
                body: { error },
            } = await fetchDownloadLink({
                dataSourceId: '5ff5ba21d3ace12d33fdb826',
                downloadId: 'yptes',
            });
            expect(error.message).to.match(/not be longer than/i);
            expect(error.code).to.eql(StatusCodes.BAD_REQUEST);
        });

        it('should fail too short downloadId', async () => {
            const {
                body: { error },
            } = await fetchDownloadLink({
                dataSourceId: '5ff5ba21d3ace12d33fdb826',
                downloadId: 'ypt',
            });
            expect(error.message).to.match(/not be shorter than/i);
            expect(error.code).to.eql(StatusCodes.BAD_REQUEST);
        });
        it('should fail with non valid downloadId', async () => {
            const {
                body: { error },
            } = await fetchDownloadLink({
                dataSourceId: '5ff5ba21d3ace12d33fdb826',
                downloadId: 'ypt-',
            });
            expect(error.message).to.match(/alphanumeric value/i);
            expect(error.code).to.eql(StatusCodes.BAD_REQUEST);
        });
    });

    it('generate a download link and fetch it', async () => {
        sinon.restore();
        const name = uuid();
        await createDataSource({ body: { name } });
        const { body: dataSource } = await updateVersion({
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
        const fileIds = dataSource.files.slice(0, 2).map(file => file.id);
        const {
            body,
            response: { statusCode },
        } = await createDownloadLink({
            dataSourceId: dataSource.id,
            fileIds,
        });
        expect(body).to.have.ownProperty('href');
        const { href } = body;
        const [, downloadId] = href.split('download_id=');
        expect(statusCode).to.eq(StatusCodes.CREATED);
        expect(await fse.pathExists(`${ZIP_DIRECTORY}/${downloadId}.zip`)).to.be
            .true;
        const { response } = await fetchDownloadLink({ href });
        expect(response.statusCode).to.eq(StatusCodes.OK);
    });

    it('should fail with non existing download Id', async () => {
        const { response } = await fetchDownloadLink({
            dataSourceId: '5ff5ba21d3ace12d33fdb826',
            downloadId: 'nope',
        });
        expect(response.statusCode).to.eq(StatusCodes.NOT_FOUND);
    });
});
