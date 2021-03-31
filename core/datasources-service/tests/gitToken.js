const { default: axios } = require('axios');
const { uid } = require('@hkube/uid');

const constructUrl = ({ name, password, endpoint }) => {
    const url = new URL(endpoint);
    return `${url.protocol}//${name}:${password}@${url.host}/api/v1/users/${name}/tokens`;
};

/**
 * @typedef {import('./../lib/utils/types').config} Config
 * @typedef {{
 *     id: 1;
 *     name: 'my-token';
 *     sha1: 'cb9ab2edc28b9d487bcd46873f5a62f64f12f887';
 *     token_last_eight: '4f12f887';
 * }} GitToken
 */

/** @returns {Promise<GitToken>} */
const setupGithubToken = async ({ user: { name, password }, endpoint }) => {
    const url = constructUrl({ name, password, endpoint });
    const response = await axios.post(url, { name: `test-token-${uid()}` });
    return response.data;
};

/**
 * @param {any}      any
 * @param {GitToken} token
 */
const removeGithubToken = async (
    { user: { name, password }, endpoint },
    token
) => {
    const url = constructUrl({ name, password, endpoint });
    await axios.delete(`${url}/${token.id}`);
    return null;
};

/** @param {{ token: string }} config */
const getGitlabToken = config => config.token;

module.exports = {
    setupGithubToken,
    removeGithubToken,
    getGitlabToken,
};
