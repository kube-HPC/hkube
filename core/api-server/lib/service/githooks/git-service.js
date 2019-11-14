const Octokit = require('@octokit/rest');
const urlLib = require('url');
const { InvalidDataError } = require('../../errors');
const octokit = new Octokit();

class GitService {
    async getGithubLastCommit({ url, branchName }) {
        const { owner, repo } = this._parseGithubUrlRepo(url);
        let lastCommit;
        const params = {
            owner,
            repo,
            sha: branchName,
            per_page: 1,
            page: 1
        };
        try {
            lastCommit = await octokit.repos.listCommits(params);
        }
        catch (error) {
            throw new InvalidDataError(`${error.message} (${url})`);
        }
        return lastCommit.data[0];
    }

    async getGitlabLastCommit({ url, branchName, token }) {

    }

    _parseGithubUrlRepo(url) {
        const parsedUrl = urlLib.parse(url);
        const [, owner, repo] = parsedUrl.pathname.split('/');
        if (!owner || !repo) {
            throw new InvalidDataError(`invalid url '${url}'`);
        }
        return {
            owner,
            repo
        };
    }
}

module.exports = new GitService();
