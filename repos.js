const githubRepos = require('github-repositories');
let reposNames = ['hkube', 'simulator', 'pipeline-driver', 'api-server', 'worker', 'algoPackage', 'algorunner', 'common'];
let commonReposNames = ['statistic-check.hkube', 'rest-server.hkube',
    'producer-consumer.hkube', 'etcd.hkube', 'backoff.hkube', 'request-reply.hkube',
    'redis-utils.hkube', 'pub-sub-adapter.hkube', 'logger.hkube', 'elastic-client.hkube', 'config.hkube']


const gitHubRepos = () => {
    githubRepos('kube-HPC').then(data => {
        let repos = data.map(r => r.name)
        commonReposNames = repos.filter(r => r.split('.')[1] != null);
        reposNames = repos.filter(r => r.split('.')[1] == null);
        //=> [{id: 29258368, name: 'animal-sounds', full_name: 'kevva/animal-sounds', ...}, ...] 
    });

}


module.exports = {
    reposNames,
    commonReposNames
};
gitHubRepos();

