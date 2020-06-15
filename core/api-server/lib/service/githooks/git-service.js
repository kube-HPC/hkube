const { Octokit } = require('@octokit/rest');
const { ProjectsBundle } = require('gitlab');
const urlLib = require('url');
const { InvalidDataError } = require('../../errors');

class GitService {
    async getGithubCommit({ url, commitId, tag, branchName, token }) {
        let lastCommit;
        const { owner, repo } = this._parseGitUrl(url);
        const params = {
            owner,
            repo,
            sha: commitId || tag || branchName,
            per_page: 1,
            page: 1
        };
        try {
            const octokit = new Octokit({ auth: token });
            lastCommit = await octokit.repos.listCommits(params);
        }
        catch (error) {
            throw new InvalidDataError(`${error.message} (${url})`);
        }
        const data = lastCommit.data[0];
        const commit = {
            id: data.sha,
            timestamp: data.commit.committer.date,
            message: data.commit.message
        };
        return commit;
    }

    async getGitlabCommit({ url, commitId, tag, branchName, token }) {
        let lastCommit;
        const { host, owner, repo } = this._parseGitUrl(url);
        const params = {
            perPage: 1,
            maxPages: 1,
            showPagination: false,
            ref_name: commitId || tag || branchName
        };
        try {
            const services = new ProjectsBundle({ host, token });
            lastCommit = await services.Commits.all(`${owner}/${repo}`, params);
        }
        catch (error) {
            throw new InvalidDataError(`${error.message} (${url})`);
        }
        const data = lastCommit.data[0];
        const commit = {
            id: data.id,
            timestamp: data.committed_date,
            message: data.message
        };
        return commit;
    }

    _parseGitUrl(url) {
        const parsedUrl = urlLib.parse(url);
        const [, owner, repo] = parsedUrl.pathname.split('/');
        if (!owner || !repo) {
            throw new InvalidDataError(`invalid url '${url}'`);
        }
        return {
            owner,
            repo,
            host: `${parsedUrl.protocol}//${parsedUrl.hostname}/`
        };
    }
}

module.exports = new GitService();
