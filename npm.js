#!/usr/bin/env node

let folder = `${process.env.HOME}/dev/hkube/`
const i = require('npm-i')
const fs = require('fs');
const colors = require('colors');
const stringToRepos = require('./stringToRepos');


const npm = async (reposTypes) => {
    let repos = await stringToRepos(reposTypes)
    repos.forEach(r => {
        npmInternal(r);
    })
}

const npmInternal = (reposObj) => {
    reposObj.repo.forEach(r => {
        let path = `${reposObj.folder}${r}`;
        try {
            if (fs.existsSync(path)) {
                console.log(`start npm install ${path}`.green);
                i({ path }, err => {
                    if (err) throw err
                    console.log(`${path} Installed dependencies!`.green)
                })
            }
            else {
                console.log(`${path} already exists`.green);
            }

        } catch (e) {
            console.log(`error:${e}`.green);
        }
    });


}


module.exports = npm;



