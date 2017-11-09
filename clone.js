#!/usr/bin/env node
const folder = `${process.env.HOME}/dev/hkube/`
const git = require('simple-git')(folder);
const i = require('npm-i')
const fs = require('fs');
const colors = require('colors');
const gitPrefix = "git@gitlab.com:greenapes/hkube/"
const stringToRepos = require('./stringToRepos');

const clone = (reposTypes) => {
    stringToRepos(reposTypes).forEach(r => {
        cloneInternal(r);
    })
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
            .then(res => resolve(res))
            .catch(err => reject(err))
    });
}



module.exports = clone;