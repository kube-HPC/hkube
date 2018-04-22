const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path')
const tempfile = require('tempfile')
const jsYaml = require('js-yaml')
const objectPath = require('object-path');
const kubernetes = require('./kubernetes');

const changeYamlImageVersion = async (yamlFile, versions, coreYamlPath, registry) => {
    versions = versions || { versions: [] }
    const fullPath = path.isAbsolute(yamlFile) ? yamlFile : `${coreYamlPath}/${yamlFile}`;
    try {
        const fileContents = fs.readFileSync(fullPath, 'utf8');
        const yml = jsYaml.loadAll(fileContents);
        const images = [];
        let waitObjectName;
        for (y of yml) {
            if (!y){
                continue;
            }
            if (!waitObjectName && (y.kind === 'Deployment' || y.kind === 'EtcdCluster')) {
                waitObjectName = y.metadata.name;
            }
            
            if (y.kind === 'Deployment'){
                const replicas = await kubernetes.getDeploymentReplicas({deployment:y.metadata.name});
                if (replicas){
                    objectPath.set(y,'spec.replicas',replicas);
                }
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

                const busyboxImage = objectPath.get(y, 'spec.pod.busyboxImage', 'busybox:1.28.0-glibc');
                if (busyboxImage) {
                    const image = busyboxImage;
                    const imageParsed = parseImageName(image);
                    const x = _.merge(imageParsed, { registry })
                    const container = {
                        image,
                        paths: [
                            {
                                path:'spec.pod.busyboxImage',
                                value: createImageName(x)
                            }
                        ]
                    }
                    containers.push(container);
                }
            } 
            else {
                let containersFromYaml = objectPath.get(y, 'spec.template.spec.containers');
                if (!containersFromYaml){
                    containersFromYaml = objectPath.get(y, 'spec.jobTemplate.spec.template.spec.containers');
                }
                if (!containersFromYaml){
                    containersFromYaml = objectPath.get(y, 'spec.containers');
                }
                if (containersFromYaml) {
                    containers.push(...containersFromYaml);
                }
            }
            if (containers.length === 0) {
                continue;
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
        }
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
    changeYamlImageVersion,
    parseImageName,
    createImageName,
    imageFullName
}