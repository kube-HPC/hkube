const semverLib = require('semver');
const { uid } = require('@hkube/uid');
const stateManager = require('../state/state-manager');

const SETTINGS = {
    SEMVER: {
        FIRST: '1.0.0',
        MAX_PATCH: 500,
        MAX_MINOR: 500,
        MAX_MAJOR: 500
    },
    VERSION_LENGTH: 10
};

class Versioning {
    async createVersion(object, isPipeline = false) {
        const extractedObject = isPipeline ? object.pipeline : object.algorithm;
        const { name } = extractedObject;
        const version = uid({ length: SETTINGS.VERSION_LENGTH });
        const latestSemver = await this.getLatestSemver({ name }, isPipeline);
        const semver = this.incSemver(latestSemver);
        const newVersion = {
            version,
            semver,
            created: Date.now(),
            name,
            [isPipeline ? 'pipeline' : 'algorithm']: { ...extractedObject, version }
        };
        await stateManager.createVersion(newVersion, isPipeline);
        return version;
    }

    async getLatestSemver({ name }, isPipeline = false) {
        const versions = await stateManager.getVersions({ name, limit: 1 }, isPipeline);
        return versions?.[0]?.semver;
    }

    async getVersions(options, isPipeline = false) {
        const { name } = options;
        const versions = await stateManager.getVersions({ name }, isPipeline);
        return versions;
    }

    async getVersion({ version }, isPipeline = false) {
        const data = await stateManager.getVersion({ version }, isPipeline);
        return data;
    }

    incSemver(oldVersion) {
        let version;

        if (!oldVersion) {
            version = SETTINGS.SEMVER.FIRST;
        }
        else {
            const ver = semverLib.valid(oldVersion);
            if (!ver) {
                version = oldVersion;
            }
            else {
                const { patch, minor, major } = semverLib.parse(oldVersion);
                if (patch < SETTINGS.SEMVER.MAX_PATCH) {
                    version = semverLib.inc(oldVersion, 'patch');
                }
                else if (minor < SETTINGS.SEMVER.MAX_MINOR) {
                    version = semverLib.inc(oldVersion, 'minor');
                }
                else if (major < SETTINGS.SEMVER.MAX_MAJOR) {
                    version = semverLib.inc(oldVersion, 'major');
                }
            }
        }
        return version;
    }
}

module.exports = new Versioning();
