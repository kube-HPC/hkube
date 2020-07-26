const delay = require('delay');
const { expect } = require('chai');
const sinon = require('sinon');
const backPressure = require('../lib/streaming/back-pressure');

describe('BackPressure', () => {
    it('should set inititial state to bootstrap', () => {
        const data = [
            { algorithm: 'a', median: 5000, queueSize: 30 },
            { algorithm: 'b', median: 3000, queueSize: 30 },
            { algorithm: 'c', median: 1000, queueSize: 30 }
        ];
        backPressure.report(data);

    });

});
