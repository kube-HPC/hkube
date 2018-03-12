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

const changeYamlImageVersion = (yamlFile, versions, coreYamlPath, registry) => {
    versions = versions || { versions: [] }
    const fullPath = path.isAbsolute(yamlFile) ? yamlFile : `${coreYamlPath}/${yamlFile}`;
    try {
        const fileContents = fs.readFileSync(fullPath, 'utf8');
        const yml = jsYaml.loadAll(fileContents);
        const images = [];
        let waitObjectName;
        yml.forEach(y => {
            if (!y){
                return;
            }
            if (!waitObjectName && (y.kind === 'Deployment' || y.kind === 'EtcdCluster')) {
                waitObjectName = y.metadata.name;
            }
            const containers = [];
            if (y.kind === 'EtcdCluster') {
                // special handling of etcd operator object
                const version = objectPath.get(y, 'spec.version');
                const repository = objectPath.get(y, 'spec.repository', 'quay.io/coreos/etcd');
                if (version && repository) {
                    const image = `${repository}:${version}`;
                    const imageParsed = parseImageName(image);
                    const x = _.merge(imageParsed, { registry })
                    const container = {
                        image: `${repository}:v${version}`,
                        paths: [
                            {
                                path:'spec.version',
                                value: version
                            },
                            {
                                path:'spec.repository',
                                value: createImageName(x,true)
                            }
                        ]
                    }
                    containers.push(container);
                }

                const busyboxVersion = objectPath.get(y, 'spec.busyboxVersion', '1.28.0-glibc');
                const busyboxRepository = objectPath.get(y, 'spec.busyboxRepository', 'busybox');
                if (busyboxVersion && busyboxRepository) {
                    const image = `${busyboxRepository}:${busyboxVersion}`;
                    const imageParsed = parseImageName(image);
                    const x = _.merge(imageParsed, { registry })
                    const container = {
                        image,
                        paths: [
                            {
                                path:'spec.busyboxVersion',
                                value: busyboxVersion
                            },
                            {
                                path:'spec.busyboxRepository',
                                value: createImageName(x,true)
                            }
                        ]
                    }
                    containers.push(container);
                }
            }
            else {
                const containersFromYaml = objectPath.get(y, 'spec.template.spec.containers');
                if (containersFromYaml) {
                    containers.push(...containersFromYaml);
                }
            }
            if (containers.length === 0) {
                return;
            }
            containers.forEach(c => {
                const imageParsed = parseImageName(c.image);
                const imageName = imageParsed.repository;
                if (imageParsed.tag && imageParsed.tag !== 'latest') {
                    const x = _.merge(imageParsed, { registry, fullImageName: c.image })
                    if (y.kind === 'EtcdCluster') {
                        c.paths.forEach(p=>{
                            objectPath.set(y,p.path,p.value);
                        })
                    }
                    else {
                        const forImageName = _.merge(imageParsed, { registry });
                        c.image = createImageName(forImageName)
                    }
                    images.push(x);
                    console.log(`service ${imageName}. found version ${imageParsed.tag}`)
                    return;
                }

                const version = versions.versions.find(v => v.project === imageName);
                const tag = version ? version.tag : 'latest';
                const forImageName = _.merge(imageParsed, { registry, tag });
                c.image = createImageName(forImageName);
                let x = _.merge(imageParsed, { registry, tag, fullImageName: c.image });
                const fullname = imageFullName({ ...x });
                x = _.merge(x, { fullname })
                images.push(x);
                console.log(`service ${imageName}. found version ${tag}`)
            })
        });
        let withVersions = yml.filter(y=>y).map(y => jsYaml.safeDump(y))
        withVersions = withVersions.join('\r\n---\r\n')
        const tmpFileName = tempfile('.yml');
        fs.writeFileSync(tmpFileName, withVersions, 'utf8');
        return { tmpFileName, images, waitObjectName };
    }
    catch (e) {
        console.error(`error parsing yaml ${fullPath}. error is: ${e}`);
        return { tmpFileName: fullPath };
    }
}

const createImageName = ({ registry, namespace, repository, tag },ignoreTag) => {
    let array = [registry, namespace, repository];
    array = array.filter(a => a);
    let image = array.join('/');
    if (tag && !ignoreTag) {
        image = `${image}:${tag}`;
    }
    // let image = `${registry||''}/${namespace||''}/${repository||''}:${tag||''}`;
    // image = image.replace('//','/');
    return image;
}
const parseImageName = (image) => {
    var match = image.match(/^(?:([^\/]+)\/)?(?:([^\/]+)\/)?([^@:\/]+)(?:[@:](.+))?$/)
    if (!match) return null

    var registry = match[1]
    var namespace = match[2]
    var repository = match[3]
    var tag = match[4]

    if (!namespace && registry && !/[:.]/.test(registry)) {
        namespace = registry
        registry = null
    }

    var result = {
        registry: registry || null,
        namespace: namespace || null,
        repository: repository,
        tag: tag || null
    }

    registry = registry ? registry + '/' : ''
    namespace = namespace && namespace !== 'library' ? namespace + '/' : ''
    tag = tag && tag !== 'latest' ? ':' + tag : ''

    result.name = registry + namespace + repository + tag
    result.fullname = registry + (namespace || 'library/') + repository + (tag || ':latest')

    return result
}

const imageFullName = ({ registry, namespace, repository, tag }) => {
    registry = registry ? registry + '/' : '';
    namespace = namespace && namespace !== 'library' ? namespace + '/' : '';
    const fullname = registry + (namespace || 'library/') + repository + (tag || ':latest');
    return fullname;
}
module.exports = {
    getLatestVersions,
    changeYamlImageVersion,
    cloneRepo,
    parseImageName,
    createImageName,
    imageFullName
}