const fse = require('fs-extra');
const { uuid } = require('@hkube/uid');
const { Producer } = require('@hkube/producer-consumer');
const qs = require('query-string');
const { request } = require('./request');
const { fileName, createRepository } = require('./utils');

const setupUrl = ({ name, id }) => {
    const uri = `${global.testParams.restUrl}/datasource`;
    return id && name
        ? `${uri}/${name}?id=${id}`
        : id
            ? `${uri}/id/${id}`
            : `${uri}/${name}`;
};

const createDataSource = async (
    name,
    {
        withFile = true,
        fileNames = [fileName],
        ignoreGit = false,
        ignoreStorage = false,
        useGitlab = false,
        storageOverrides = {},
        gitOverrides = {},
        useInternalStorage = false,
        useInternalGit = false,
        skipCreateRepository = false,
    } = {}
) => {
    const { storage, git, restUrl, _git } = global.testParams;

    const gitKind = (() => {
        if (useInternalGit) return 'internal';
        if (useGitlab) return 'gitlab';
        return 'github';
    })();

    let repositoryUrl;
    if (!useInternalGit && !skipCreateRepository && name) {
        repositoryUrl = await createRepository(
            {
                endpoint: _git[gitKind].endpoint,
                token: git[gitKind].token,
                kind: gitKind,
            },
            name
        );
    }

    const gitConfig = (() => {
        if (ignoreGit) return;
        if (gitKind === 'internal') return;
        return { ...git[gitKind], repositoryUrl };
    })();

    const uri = `${restUrl}/datasource`;

    const formData = (() => {
        const form = {};
        // check for string for empty name
        if (typeof name === 'string' || name) {
            form.name = name;
        }
        if (withFile) {
            form.files = fileNames.map(name =>
                fse.createReadStream(`tests/mocks/${name}`)
            );
        }
        if (!ignoreStorage) {
            form.storage = JSON.stringify(
                useInternalStorage
                    ? { kind: 'internal' }
                    : { kind: 'S3', ...storage, ...storageOverrides }
            );
        }
        if (!ignoreGit) {
            form.git = JSON.stringify(
                useInternalGit
                    ? { kind: 'internal' }
                    : { ...gitConfig, ...gitOverrides }
            );
        }
        return form;
    })();

    const options = { uri, formData };
    return request(options);
};

const updateVersion = async ({
    dataSourceName,
    versionDescription = 'new-version',
    fileNames = [],
    files: _files = [],
    mapping: _mapping = [],
    droppedFileIds: _droppedFileIds = [],
}) => {
    const uri = setupUrl({ name: dataSourceName });
    const normalizedMapping = _mapping.reduce(
        (acc, item) => ({ ...acc, [item.id]: item }),
        {}
    );
    const files = fileNames
        .map(name => ({ name, id: uuid() }))
        .concat(_files)
        .map(file => ({
            value: fse.createReadStream(`tests/mocks/${file.name}`),
            options: {
                filename: normalizedMapping[file.id] ? file.id : file.name,
            },
        }));

    const mapping = _mapping.length > 0 ? JSON.stringify(_mapping) : [];

    const droppedFileIds =
        _droppedFileIds.length > 0 ? JSON.stringify(_droppedFileIds) : [];

    const formData = {
        versionDescription,
        files,
        mapping,
        droppedFileIds,
    };
    const options = { uri, formData };
    return request(options);
};

const fetchDataSource = ({ name, id }) => {
    const getOptions = {
        uri: setupUrl({ name, id }),
        method: 'GET',
    };
    return request(getOptions);
};

const deleteDataSource = ({ name }) => {
    const deleteOptions = {
        uri: setupUrl({ name }),
        method: 'DELETE',
    };
    return request(deleteOptions);
};

const fetchDataSourceVersions = ({ name }) => {
    const uri = `${setupUrl({ name })}/versions`;
    const getOptions = {
        uri,
        method: 'GET',
    };
    return request(getOptions);
};

const createJob = async ({ dataSource }) => {
    const config = global.testParams.config;
    const producer = new Producer({
        setting: {
            redis: config.redis,
        },
    });
    const { prefix, type } = config.jobs.consumer;
    const job = {
        prefix,
        type,
        data: {
            jobId: uuid(),
            taskId: uuid(),
            nodeName: uuid(),
            dataSource,
        },
    };
    await producer.createJob({ job });
    return job;
};

const fetchSnapshot = ({
    dataSourceName,
    snapshotName,
    shouldResolve = false,
}) =>
    request({
        uri: `${setupUrl({
            name: dataSourceName,
        })}/snapshot/${snapshotName}?resolve=${shouldResolve}`,
        method: 'GET',
    });

const fetchAllSnapshots = ({ dataSourceName }) =>
    request({
        uri: `${setupUrl({ name: dataSourceName })}/snapshot`,
        method: 'GET',
    });

const createSnapshot = ({ name, id, snapshot }) =>
    request({
        uri: `${setupUrl({ id, name })}/snapshot`,
        body: { snapshot },
    });


const createDownloadLink = ({ dataSourceId, fileIds }) =>
    request({
        uri: `${setupUrl({ id: dataSourceId })}/download`,
        method: 'POST',
        body: { fileIds },
    });

const fetchDownloadLink = ({ dataSourceId, downloadId, href }) =>
    href
        ? request({

            uri: `${global.testParams.restUrl}/${href}`,
            method: 'GET',
        })
        : request({
            uri: `${setupUrl({
                id: dataSourceId,
            })}/download?download_id=${downloadId}`,
            method: 'GET',
        });

const requestValidation = ({ name = null, id = null, snapshotName = null }) => {
    const query = qs.stringify(
        { id, name, snapshot_name: snapshotName },
        { skipNull: true }
    );

    const url = `${global.testParams.restUrl}/datasource/validate?${query}`;
    return request({ uri: url.toString(), method: 'GET' });
};

const requestPreview = ({ dataSourceId, query }) =>
    request({
        uri: `${setupUrl({ id: dataSourceId })}/snapshot/preview`,
        body: { query },
    });

const syncDataSource = ({ name }) =>
    request({ uri: `${setupUrl({ name })}/sync` });


const updateCredentials = async ({
    name,
    credentials,
    ignoreCredentials = false,
}) =>
    request({
        uri: `${setupUrl({ name })}/credentials`,
        body: ignoreCredentials ? {} : { credentials },
        method: 'PATCH',
    });

module.exports = {
    fetchDataSource,
    deleteDataSource,
    fetchDataSourceVersions,
    createDataSource,
    updateVersion,
    createJob,
    syncDataSource,
    fetchSnapshot,
    createSnapshot,
    fetchAllSnapshots,
    createDownloadLink,
    fetchDownloadLink,
    requestValidation,
    requestPreview,
    updateCredentials,
};
