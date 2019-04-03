const { expect } = require('chai');
const { findVersion } = require('../lib/helpers/images');
const versions = {
    systemVersion: '1.1.1',
    versions: [
        {
            project: 'proj1',
            tag: 'v2.3.4'
        },
        {
            project: 'proj2',
            tag: 'v1.2.3'
        }
    ]
};
describe('findVersion', () => {
    it('should return latest if not found', () => {
        const res = findVersion({ versions, repositoryName: 'proj3' });
        expect(res).to.eql('latest');
    });
    it('should return version if found', () => {
        const res = findVersion({ versions, repositoryName: 'proj2' });
        expect(res).to.eql('v1.2.3');
    });
    it('should return version if found 2', () => {
        const res = findVersion({ versions, repositoryName: 'proj1' });
        expect(res).to.eql('v2.3.4');
    });
});
