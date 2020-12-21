const { uuid } = require('@hkube/uid');
const fse = require('fs-extra');
const { request } = require('./utils');

// a valid mongo ObjectID;
const nonExistingId = '5f953d50dd38c8291924a0a3';
const fileName = 'README-1.md';
/** @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta */
/**
 * @type {(props?: {
 *     body?: { name?: string };
 *     withFile?: boolean;
 *     fileNames?: string[];
 * }) => Promise<any>}
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
    const options = {
        uri,
        formData,
    };
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
    const uri = `${global.testParams.restUrl}/datasource`;
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
    const options = {
        uri: `${uri}/${dataSourceName}`,
        formData,
    };
    return request(options);
};

/** @param {{ name?: string; id?: string }} query */
const fetchDataSource = ({ name, id }) => {
    const uri = `${global.testParams.restUrl}/datasource`;
    const getOptions = {
        uri:
            id && name
                ? `${uri}/${name}?version_id=${id}`
                : id
                ? `${uri}/id/${id}`
                : `${uri}/${name}`,
        method: 'GET',
    };
    return request(getOptions);
};

/** @param {{ name: string }} query */
const fetchDataSourceVersions = ({ name }) => {
    const uri = `${global.testParams.restUrl}/datasource/${name}/versions`;
    const getOptions = {
        uri,
        method: 'GET',
    };
    return request(getOptions);
};

module.exports = {
    fetchDataSource,
    fetchDataSourceVersions,
    createDataSource,
    updateVersion,
    nonExistingId,
    fileName,
};
