#!/usr/bin/env node

const folder = `${process.env.HOME}/dev/hkube/`
const simpleGit = require('simple-git');
const i = require('npm-i')
const fs = require('fs');
const colors = require('colors');
const { semaphore } = require('await-done');
const gitPrefix = "git@gitlab.com:greenapes/hkube/"
const stringToRepos = require('./stringToRepos');

const pull = async (reposTypes) => {
    //  const promiseArr = [];

    let repos = await stringToRepos(reposTypes);
    for (repo of repos) {
        await pullInternal(repo);
    }
    return;
}


const pullInternal = async (reposObj) => {
    let promiseArr = [];

    const git = simpleGit(folder);
    let repos = reposObj.repo;
    for (r of repos) {
        let sema = new semaphore();
        let path = `${reposObj.folder}${r}`;
        let fullRepo = `${reposObj.git}/${r}.git`;
        try {
            if (fs.existsSync(path)) {
                console.log(`pull is  started for ${fullRepo} to path: ${path}`.green);
                try {
                    git.cwd(path).pull(res => {
                        console.log(`repo ${r} pull finished `.green)
                        if (res) {
                            console.log(res)
                        }
                        else {
                            console.log(`everything is up to data`.green);
                        }
                        sema.callDone()
                    })
                } catch (e) {
                    console.log(`Error:${e} `.red);
                    sema.callDone()
                }
                await sema.done();
            }
            else {
                console.log(`${path} not exists`.green);

            }

        } catch (e) {
            console.log(`error:${e}`.green);
            reject(e);
        }

    }

}



module.exports = pull;