const { Gitlab } = require('@gitbeaker/node');

const removeAllRepos = async gitlabConfig => {
    const gitClient = new Gitlab({
        host: gitlabConfig.endpoint,
        token: gitlabConfig.token,
        tokenName: gitlabConfig.tokenName,
    });
    try {
        const projects = await gitClient.Projects.all();
        await Promise.all(
            projects
                .filter(project => project)
                .filter(project => project.name !== 'Monitoring')
                .map(project => gitClient.Projects.remove(project.id))
        );
    } catch (error) {
        console.error({ error });
    }
};

module.exports = { removeAllRepos };
