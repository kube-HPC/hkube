const { expect } = require('chai');
const concurrencyMap = require('../lib/jobs/concurrency-map');

describe('concurrency', () => {
    it('should disable max exceeded jobs', async () => {
        const name = 'test-max';
        const pipeline1 = {
            name,
            concurrency: {
                max: 5,
                maxExceeded: true,
            }
        }
        const pipeline2 = {
            name,
            concurrency: {
                max: 5,
                maxExceeded: true,
            }
        }
        const pipeline3 = {
            name,
            concurrency: {
                max: 5,
                maxExceeded: true,
            }
        }
        concurrencyMap.mapActiveJobs([{ name }, { name }]);
        concurrencyMap.disableMaxExceeded(pipeline1);
        concurrencyMap.disableMaxExceeded(pipeline2);
        concurrencyMap.disableMaxExceeded(pipeline3);

        expect(pipeline1.concurrency.maxExceeded).to.eql(false);
        expect(pipeline2.concurrency.maxExceeded).to.eql(false);
        expect(pipeline3.concurrency.maxExceeded).to.eql(false);
    });
});