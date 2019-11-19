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
        return lastCommit.data[0];
    }

    async getGitlabLastCommit({ url, branchName = 'maste', token = null }) {
        const { owner, repo } = this._parseGithubUrlRepo(url);

        const services = new ProjectsBundle({
            host: 'https://gitlab.com/',
            token
        });
        // 'inkscape/inkscape'

        const lastCommit = await services.Commits.all(`${owner}/${repo}`, {
            perPage: 1,
            maxPages: 1,
            showPagination: true,
            ref_name: branchName
        });
        return lastCommit.data[0];
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
