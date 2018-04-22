const _ = require('lodash');
const GitHubApi = require('@octokit/rest')
const semver = require('semver')
const fs = require('fs-extra');
const path = require('path')
const tempfile = require('tempfile')
const jsYaml = require('js-yaml')
const request = require('request-promise')
const objectPath = require('object-path');
const git = require('simple-git/promise');

const HKUBE = 'Kube-HPC'
const RELEASE_MANAGER_REPO = 'release-manager'

const cloneRepo = async (repo, tag, localFolder) => {
    const repoUrl = `https://github.com/${HKUBE}/${repo}`;
    if (fs.existsSync(localFolder)) {
        console.error(`Clone folder ${localFolder} already exist. Skipping`);
        return;
    }
    console.log(`cloning ${repoUrl} into ${localFolder}`);

    await git().clone(repoUrl, localFolder);
    await git(localFolder).checkout(tag);
}
const paginationHelper = async (github, method, options) => {
    let response = await method({ ...options, per_page: 200 });
    let { data } = response;
    while (github.hasNextPage(response)) {
        response = await github.getNextPage(response, { 'user-agent': HKUBE });
        data = data.concat(response.data);
    }
    return data;

}

const getLatestVersions = async (prefix) => {
    const github = new GitHubApi({
        // debug: true,
        headers: {
            'Accept': ' application/vnd.github.mercy-preview+json',
            'user-agent': HKUBE
        }
    });
    if (process.env.GH_TOKEN) {
        github.authenticate({
            type: 'oauth',
            token: process.env.GH_TOKEN || undefined
        })

    }

    try {
        const releases = await paginationHelper(github, github.repos.getReleases, {
            owner: HKUBE,
            repo: RELEASE_MANAGER_REPO,
        });
        let filteredReleses = releases.map(r => ({
            // name: r.name.startsWith('v')?r.name.substr(1):r.name,
            name: r.name,
            assets: r.assets
        }));;
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


module.exports = {
    getLatestVersions,
    cloneRepo
}