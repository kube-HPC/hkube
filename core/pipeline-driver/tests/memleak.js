const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const { iterate } = require('leakage')
const memwatch = require('@airbnb/node-memwatch');
const delay = d => new Promise(r => setTimeout(r, d));

describe('Test', function () {
    before(() => {

    })
    xdescribe('Memory Leaks', () => {
        it('does not leak when doing stuff', async function () {
            this.timeout(1200000);

            memwatch.on('stats', function (stats) {
                console.log(JSON.stringify(stats, null, 2));
            });

            const hd = new memwatch.HeapDiff();

            let batch = [];

            await delay(2000);

            for (let i = 0; i < 25000; i++) {
                batch.push({ g: 1, k: 4, n: 1, o: 'bla' });
            }
            await delay(2000);

            for (let i = 0; i < 25000; i++) {
                batch.push({ g: 1, k: 4, n: 1, o: 'bla' });
            }

            await delay(2000);

            const diff = hd.end();
            console.log(JSON.stringify(diff, null, 2));

            // iterate(() => {
            //     const node = new Node(config);
            // })

        })
    })
});
