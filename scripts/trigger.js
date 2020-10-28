#!/usr/bin/env node
const request = require('request-promise');
const packageVersion = require('../package.json').version;
const main = async () => {
    try {
        if ((process.env.TRAVIS_BRANCH === 'master' || process.env.TRAVIS_TAG) && process.env.TRAVIS_PULL_REQUEST === 'false') {
            const URL = 'https://api.travis-ci.com/repo/kube-HPC%2Frelease-manager/requests';
            const TOKEN = process.env.TRAVIS_API_TOKEN;
            const TRAVIS_REPO_SLUG = process.env.TRAVIS_REPO_SLUG;
            const options = {
                url: URL,
                method: 'POST',
                json: true,
                headers: {
                    accept: 'application/json',
                    authorization: `token ${TOKEN}`,
                    'content-type': 'application/json',
                    'travis-api-version': 3
                },
                body: {
                    request: {
                        branch: 'master',
                        message: `triggered by ${TRAVIS_REPO_SLUG}`,
                        config: {
                            merge_mode: 'deep_merge',
                            env: {
                                VERSION: `v${packageVersion}`
                            }
                        }

                    }

                }
            };
            const res = await request(options)
        }
        else {
            console.log('TRAVIS_PULL_REQUEST');
        }


    } catch (error) {
        console.error(error)
    }
}

main();