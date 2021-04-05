const { expect } = require('chai');
const { uid } = require('@hkube/uid');

const stateAdapter = require('../lib/states/stateAdapter');

describe('datasources tests', () => {
    it('should fail with empty datasource', async () => {
        const ds = {

        }
        await expect(stateAdapter.getDataSource({ datasource: ds })).to.eventually.be.rejected;
    });
    it('should return correct paths', async () => {
        const datasource = await stateAdapter._db.dataSources.create({ name: uid(5), git: null, storage: null });
        const updatedDataSource = await stateAdapter._db.dataSources.updateFiles({
            id: datasource.id,
            files: [
                {
                    path: "/",
                    id: uid(5),
                    name: "file1",
                    size: 200,
                    type: "text/javascript",
                    meta: "",
                    uploadedAt: 1617626096385
                },
                {
                    path: "/subpath",
                    id: uid(5),
                    name: "file2",
                    size: 300,
                    type: "text/javascript",
                    meta: "",
                    uploadedAt: 1617626096385
                }
            ],
            commitHash: 'commitHash'
        });
        const ds = {
            dataSourceId: updatedDataSource.id
        }
        const ret = await stateAdapter.getDataSource({ dataSource: ds });
        expect(ret.files).to.have.lengthOf(2);
        expect(ret.files[0].path.slice(-11)).to.eql('/data/file1');
        expect(ret.files[1].path.slice(-19)).to.eql('/data/subpath/file2');

    });
});