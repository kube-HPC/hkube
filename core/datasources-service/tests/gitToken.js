const { default: axios } = require('axios');
const { uid } = require('@hkube/uid');

const constructUrl = ({ name, password, endpoint }) => {
    const url = new URL(endpoint);
    return `${url.protocol}//${name}:${password}@${url.host}/api/v1/users/${name}/tokens`;
};

const setupGithubToken = async ({ user: { name, password }, endpoint }) => {
    const url = constructUrl({ name, password, endpoint });
    const response = await axios.post(url, { name: `test-token-${uid()}` });
    return response.data;
};

const removeGithubToken = async (
    { user: { name, password }, endpoint },
    token
) => {
    const url = constructUrl({ name, password, endpoint });
    await axios.delete(`${url}/${token.id}`);
    return null;
};

const getGitlabToken = config => config.token;

module.exports = {
    setupGithubToken,
    removeGithubToken,
    getGitlabToken,
};
