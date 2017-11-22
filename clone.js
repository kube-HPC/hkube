#!/usr/bin/env node
const fx = require('mkdir-recursive');
const simpleGit = require('simple-git');
const i = require('npm-i');
const fs = require('fs');
const colors = require('colors');
const gitPrefix = "git@github.com/kube-HPC/"
const stringToRepos = require('./stringToRepos');
let git = null;
const clone = (reposTypes) => {
    git = simpleGit(_createFolderIfNotExists());
    const promiseArr = [];
    stringToRepos(reposTypes).forEach(r => {
        promiseArr.push(cloneInternal(r));
    })
    return Promise.all(promiseArr);
}

const _createFolderIfNotExists = () => {
    const folder = `${process.env.HOME}/dev/hkube/`
    let err = fx.mkdirSync(`${process.env.HOME}/foo/bar/1`);
    // simpleGit(folder)
    return folder;
}

const cloneInternal = (reposObj) => {
    let promiseArr = [];
    return new Promise((resolve, reject) => {

        reposObj.repo.forEach(r => {

            let prom = new Promise((resolve, reject) => {

                let path = `${reposObj.folder}${r}`;
                let fullRepo = `${reposObj.git}/${r}.git`;
                try {
                    if (!fs.existsSync(path)) {
                        console.log(`clone is  started for ${fullRepo} to path: ${path}`.green);
                        git.clone(fullRepo, null, path, (error, r) => {
                            console.log(`cloned successfully: ${fullRepo}`.green)
                            resolve()
                        })
                    }
                    else {
                        console.log(`${path} already exists`.green);
                        resolve()
                    }

                } catch (e) {
                    console.log(`error:${e}`.green);
                    reject(e);
                }
            });
            promiseArr.push(prom);
        });
        Promise.all(promiseArr)
            .then(res => {
                resolve(res)
            })
            .catch(err => reject(err))
    });
}



module.exports = clone;