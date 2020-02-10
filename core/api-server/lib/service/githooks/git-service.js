const Octokit = require('@octokit/rest');
const { ProjectsBundle } = require('gitlab');
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
        const data = lastCommit.data[0];
        const commit = {
            id: data.sha,
            timestamp: data.commit.committer.date,
            message: data.commit.message
        };
        return commit;
    }

    async getGitlabLastCommit({ url, branchName = 'master', token = null }) {
        const { host, owner, repo } = this._parseGithubUrlRepo(url);

        const services = new ProjectsBundle({
            host,
            token
        });

        const lastCommit = await services.Commits.all(`${owner}/${repo}`, {
            perPage: 1,
            maxPages: 1,
            showPagination: true,
            ref_name: branchName
        });
        const data = lastCommit.data[0];
        const commit = {
            id: data.id,
            timestamp: data.committed_date,
            message: data.message
        };
        return commit;
    }

    _parseGithubUrlRepo(url) {
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
