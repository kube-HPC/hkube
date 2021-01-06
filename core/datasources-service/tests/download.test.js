const { expect } = require('chai');
const fse = require('fs-extra');
const HttpStatus = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const sinon = require('sinon');
const { request } = require('./request');
const dbConnection = require('../lib/db');
const {
    createDataSource,
    updateVersion,
    createDownloadLink,
} = require('./utils');

describe.only('download', () => {
    it('generate a download link', async () => {
        sinon.restore();
        const name = uuid();
        await createDataSource({
            body: { name },
        });
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
        const { body: response } = await createDownloadLink({
            dataSourceId: dataSource.id,
            fileIds,
        });
        console.log(response);
    });
});
