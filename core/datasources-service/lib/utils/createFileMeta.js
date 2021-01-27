const { uid } = require('@hkube/uid');
/**
 * @typedef {import('./types').FileMeta} FileMeta
 * @typedef {{ originalname: string; size: number; mimetype: string }} File
 * @type {(file: File, path?: string, prefix?: string) => FileMeta}
 */
const createFileMeta = (file, path = null, prefix = 'ser') => ({
    id: `${prefix}-${uid()}`,
    name: file.originalname,
    path: path || '/',
    size: file.size,
    type: file.mimetype,
    meta: '',
    uploadedAt: new Date().getTime(),
});

module.exports = { createFileMeta };
