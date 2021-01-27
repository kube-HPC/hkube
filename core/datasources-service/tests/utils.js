const { uuid } = require('@hkube/uid');
const { Producer } = require('@hkube/producer-consumer');
const fse = require('fs-extra');
const qs = require('query-string');
const sinon = require('sinon');
const { request } = require('./request');
/** @typedef {{ message: string; code: number }} ErrorResponse */
/**
 * @template T
 * @typedef {Promise<{
 *     body: T & { error: ErrorResponse };
 *     response: { statusCode: number; body: T & { error: ErrorResponse } };
 * }>} Response
 */

// a valid mongo ObjectID;
const nonExistingId = '5f953d50dd38c8291924a0a3';
const fileName = 'README-1.md';

/** @param {{ name?: string; id?: string }} props */
const setupUrl = ({ name, id }) => {
    // @ts-ignore
    const uri = `${global.testParams.restUrl}/datasource`;
    return id && name
        ? `${uri}/${name}?id=${id}`
        : id
        ? `${uri}/id/${id}`
        : `${uri}/${name}`;
};

/**
 * @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta
 * @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSource
 * @typedef {import('@hkube/db/lib/DataSource').DataSourceWithMeta} DataSourceWithMeta
 * @typedef {import('@hkube/db/lib/Snapshots').Snapshot} Snapshot
 */
/**
 * @type {(props?: {
 *     body?: { name?: string };
 *     withFile?: boolean;
 *     fileNames?: string[];
 * }) => Response<DataSource>}
 */
const createDataSource = ({
    body = {},
    withFile = true,
    fileNames = [fileName],
} = {}) => {
    // @ts-ignore
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
 * Provide file names to be uploaded, or a complete array of file objects
 *
 * @param {{
 *     dataSourceName: string;
 *     versionDescription?: string;
 *     fileNames?: string[];
 *     files?: { id: string; name: string }[];
 *     mapping?: {
 *         id: string;
 *         name: string;
 *         path: string;
 *     }[];
 *     droppedFileIds?: string[];
 * }} props
 * @returns {Response<DataSourceWithMeta>}
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

/**
 * @param {{ name?: string; id?: string }} query
 * @returns {Response<DataSource>}
 */
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
    // @ts-ignore
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

/**
 * @param {{
 *     dataSourceName: string;
 *     snapshotName?: string;
 *     shouldResolve?: boolean;
 * }} query
 * @returns {Response<Snapshot>}
 */
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

/**
 * @param {{ dataSourceName: string }} query
 * @returns {Response<Snapshot[]>}
 */
const fetchAllSnapshots = ({ dataSourceName }) =>
    request({
        uri: `${setupUrl({ name: dataSourceName })}/snapshot`,
        method: 'GET',
    });

/**
 * @param {{
 *     name?: string;
 *     id?: string;
 *     snapshot: { name: string; query: string };
 * }} query
 * @returns {Response<Snapshot>}
 */
const createSnapshot = ({ name, id, snapshot }) =>
    request({
        uri: `${setupUrl({ id, name })}/snapshot`,
        body: { snapshot },
    });

/**
 * @param {{ dataSourceId: string; fileIds: string[] }} query
 * @returns {Response<{ href: string }>}
 */
const createDownloadLink = ({ dataSourceId, fileIds }) =>
    request({
        uri: `${setupUrl({ id: dataSourceId })}/download`,
        method: 'POST',
        body: { fileIds },
    });

/** @param {{ href: string } | { dataSourceId: string; downloadId: string }} props */
// @ts-ignore
const fetchDownloadLink = ({ dataSourceId, downloadId, href }) =>
    href
        ? request({
              // @ts-ignore
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
    // @ts-ignore
    const url = `${global.testParams.restUrl}/datasource/validate?${query}`;
    return request({ uri: url.toString(), method: 'GET' });
};

/** @returns {Response<FileMeta[]>} */
const requestPreview = ({ dataSourceId, query }) =>
    request({
        uri: `${setupUrl({ id: dataSourceId })}/snapshot/preview`,
        body: { query },
    });

const mockRemove = () => {
    const removeMock = sinon.fake.resolves('The remove method is mocked!');
    sinon.replace(fse, 'remove', removeMock);
    return removeMock;
};

module.exports = {
    fetchDataSource,
    deleteDataSource,
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
    createDownloadLink,
    fetchDownloadLink,
    requestValidation,
    requestPreview,
    mockRemove,
};
