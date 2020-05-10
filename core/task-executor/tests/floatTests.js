const { expect } = require('chai');
const { lessWithTolerance } = require('../lib/helpers/compare');

describe('lessWithTolerance', () => {
    it('should compare exactly', () => {
        expect(lessWithTolerance(0.1, 0.2, 0)).to.be.true;
        expect(lessWithTolerance(0.1, 0.1, 0)).to.be.false;
    });
    it('should compare by tolerance', () => {
        expect(lessWithTolerance(0.1, 0.2)).to.be.true;
        expect(lessWithTolerance(0.1, 0.1)).to.be.true;
        expect(lessWithTolerance(0.1000001, 0.1)).to.be.true;
        expect(lessWithTolerance(0.5, 0.50000001)).to.be.true;
        expect(lessWithTolerance(0.51, 0.5)).to.be.false;
        expect(lessWithTolerance(0.501, 0.5)).to.be.true;
    });

});