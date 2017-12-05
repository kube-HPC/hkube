
const GitHubApi = require('github')
const semver = require('semver')
const fs = require('fs-extra');
const tempfile = require('tempfile')
const jsYaml = require('js-yaml')
const request = require('request-promise')
const objectPath = require('object-path');

const HKUBE = 'Kube-HPC'
const RELEASE_MANAGER_REPO = 'release-manager'

const getLatestVersions = async (prefix) => {
    const github = new GitHubApi({
        // debug: true,
        headers: {
            'Accept': ' application/vnd.github.mercy-preview+json'
        }
    });
    if (process.env.GH_TOKEN) {
        github.authenticate({
            type: 'oauth',
            token: process.env.GH_TOKEN || undefined
        })

    }

    try {
        const releases = await github.repos.getReleases({
            owner: HKUBE,
            repo: RELEASE_MANAGER_REPO
        });
        let filteredReleses = releases.data.map(r => ({
            // name: r.name.startsWith('v')?r.name.substr(1):r.name,
            name: r.name,
            assets: r.assets
        }));
        if (prefix && prefix !== 'latest') {
            filteredReleses = filteredReleses.filter(r => semver.satisfies(r.name, prefix));
        }
        filteredReleses = filteredReleses.sort((a, b) => semver.compare(a.name, b.name));
        const latestVersion = filteredReleses.slice(-1)[0];
        if (!latestVersion) {
            return null;
        }
        // find versions asset
        const asset = latestVersion.assets.find(a => a.name === 'version.json');
        if (!asset || !asset.browser_download_url) {
            return null;
        }

        const downloadOptions = {
            uri: asset.browser_download_url,
            json: true, // Automatically parses the JSON string in the response
            headers: {}
        };
        if (process.env.GH_TOKEN) {
            downloadOptions.headers.Authorization = `token ${process.env.GH_TOKEN}`
        }
        const versions = await request(downloadOptions);
        return versions;

    }
    catch (e) {
        console.error(e);
    }
}

const changeYamlImageVersion = (yamlFile, versions, coreYamlPath) => {
    const fullPath = `${coreYamlPath}/${yamlFile}`;
    try {
        const fileContents = fs.readFileSync(fullPath, 'utf8');
        const yml = jsYaml.loadAll(fileContents);
        yml.forEach(y => {
            const containers = objectPath.get(y, 'spec.template.spec.containers');
            if (!containers) {
                return;
            }
            containers.forEach(c => {
                c.image = c.image.substr(0, c.image.lastIndexOf(':'));
                const lastSlashIndex = c.image.lastIndexOf('/');
                let imageName;
                if (lastSlashIndex !== -1) {
                    imageName = c.image.substr(lastSlashIndex + 1)
                }
                else {
                    imageName = c.image;
                }
                const version = versions.versions.find(v => v.project === imageName);
                const tag = version ? version.tag : 'latest';
                c.image = `${c.image}:${tag}`
                console.log(`service ${imageName}. found version ${tag}`)
            })
        });
        let withVersions = yml.map(y => jsYaml.safeDump(y))
        withVersions = withVersions.join('\r\n---\r\n')
        const tmpFileName = tempfile('.yml');
        fs.writeFileSync(tmpFileName, withVersions, 'utf8');
        return tmpFileName;
    }
    catch (e) {
        return fullPath;
    }
}


module.exports = {
    getLatestVersions,
    changeYamlImageVersion
}