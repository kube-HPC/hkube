const { Octokit } = require('@octokit/rest');
const { ProjectsBundle } = require('gitlab');
const urlLib = require('url');
const { InvalidDataError } = require('../../errors');

class GitService {
    async getGithubCommit({ webUrl, commit, tag, branchName, token }) {
        let gitCommit;
        const { owner, repo } = this._parseGitUrl(webUrl);
        const params = {
            owner,
            repo,
            sha: (commit && commit.id) || tag || branchName,
            per_page: 1,
            page: 1
        };
        try {
            const octokit = new Octokit({ auth: token });
            const listCommits = await octokit.repos.listCommits(params);
            const data = listCommits.data[0];
            gitCommit = {
                id: data.sha,
                timestamp: data.commit.committer.date,
                message: data.commit.message
            };
        }
        catch (error) {
            throw new InvalidDataError(`${error.message} (${webUrl})`);
        }
        return gitCommit;
    }

    async getGitlabCommit({ webUrl, commit, tag, branchName, token }) {
        let gitCommit;
        const { host, owner, repo } = this._parseGitUrl(webUrl);
        const params = {
            perPage: 1,
            maxPages: 1,
            showPagination: false,
            ref_name: (commit && commit.id) || tag || branchName
        };
        try {
            const services = new ProjectsBundle({ host, token });
            const listCommits = await services.Commits.all(`${owner}/${repo}`, params);
            const data = listCommits[0];
            gitCommit = {
                id: data.id,
                timestamp: data.committed_date,
                message: data.message
            };
        }
        catch (error) {
            throw new InvalidDataError(`${error.message} (${webUrl})`);
        }
        return gitCommit;
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
