const { uuid } = require('@hkube/uid');
const { Producer } = require('@hkube/producer-consumer');
const fse = require('fs-extra');
const { request } = require('./request');

// a valid mongo ObjectID;
const nonExistingId = '5f953d50dd38c8291924a0a3';
const fileName = 'README-1.md';

const setupUrl = ({ name, id }) => {
    const uri = `${global.testParams.restUrl}/datasource`;
    return id && name
        ? `${uri}/${name}?version_id=${id}`
        : id
        ? `${uri}/id/${id}`
        : `${uri}/${name}`;
};

/**
 * @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta
 * @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSource
 */
/**
 * @type {(props?: {
 *     body?: { name?: string };
 *     withFile?: boolean;
 *     fileNames?: string[];
 * }) => Promise<{ body: DataSource }>}
 */
const createDataSource = ({
    body = {},
    withFile = true,
    fileNames = [fileName],
} = {}) => {
    const uri = `${global.testParams.restUrl}/datasource`;
    const formData = {
        ...body,
        files: withFile
            ? fileNames.map(name => fse.createReadStream(`tests/mocks/${name}`))
            : undefined,
    };
    const options = { uri, formData };
    return request(options);
};

/**
 * @typedef {{
 *     id: string;
 *     name: string;
 *     path: string;
 * }} MappingFile
 * @param {object} props
 * @param {string} props.dataSourceName
 * @param {string=} props.versionDescription
 * @param {string[]=} props.fileNames - Provide file names to be uploaded
 *     instead of a complete array of file objects
 * @param {{id: string, name: string}[]=} props.files
 * @param {MappingFile[]=} props.mapping
 * @param {string[]=} props.droppedFileIds
 */
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

/** @param {{ name?: string; id?: string }} query */
const fetchDataSource = ({ name, id }) => {
    const getOptions = {
        uri: setupUrl({ name, id }),
        method: 'GET',
    };
    return request(getOptions);
};

/** @param {{ name: string }} query */
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

const delay = d => new Promise(r => setTimeout(r, d));

/** @param {{ dataSourceName: string; snapshotName?: string }} query */
const fetchSnapshot = ({ dataSourceName, snapshotName }) =>
    request({
        uri: `${setupUrl({
            name: dataSourceName,
        })}/snapshot/${snapshotName}?resolve=${shouldResolve}`,
        method: 'GET',
    });

/** @param {{ dataSourceId: string }} query */
const fetchAllSnapshots = ({ dataSourceId }) =>
    request({
        uri: `${setupUrl({ id: dataSourceId })}/snapshot`,
        method: 'GET',
    });

/**
 * @param {{
 *     name: string;
 *     id?: string;
 *     snapshot: { name: string; query: string };
 * }} query
 */
const createSnapshot = ({ name, id, snapshot }) =>
    request({
        uri: `${global.testParams.restUrl}/datasource/${name}/snapshot?version_id=${id}`,
        body: snapshot,
    });

module.exports = {
    fetchDataSource,
    fetchDataSourceVersions,
    createDataSource,
    updateVersion,
    createJob,
    delay,
    nonExistingId,
    fileName,
    fetchSnapshot,
    createSnapshot,
    fetchAllSnapshots,
};
