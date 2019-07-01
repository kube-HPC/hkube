const { expect } = require('chai');
const { parseBool } = require('../lib/utils/formatters');
describe('formatter', () => {
    it('check parse bool', () => {
        expect(parseBool(undefined)).to.be.false;
        expect(parseBool(undefined,true)).to.be.true;
        expect(parseBool('true',true)).to.be.true;
        expect(parseBool('true',false)).to.be.true;
        expect(parseBool('false',true)).to.be.false;
        expect(parseBool('false',false)).to.be.false;
        expect(parseBool("True")).to.be.true;
    });
});