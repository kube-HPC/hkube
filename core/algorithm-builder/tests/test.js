
const { expect } = require('chai');
const sinon = require('sinon');
const bootstrap = require('../bootstrap');
const builder = require('../lib/builder');

describe('Test', function () {
    before(async () => {
        await bootstrap.init();
    })
    describe('Docker', function () {
        it('should build docker', async function () {
            this.timeout(30000);
            const options = {
                payload: JSON.stringify({
                    name: 'codeless',
                    env: 'nodejs'
                }),
                file: 'uploads/zipped/6976fc4e63d427705650b8c4ab77fd85'
            }
            const result = await builder.build(options);
            expect(result).to.equal();
        });
    });
});
