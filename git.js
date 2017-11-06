#!/usr/bin/env node
const folder = `${process.env.HOME}/dev/hkube/`
const git = require('simple-git')(folder);
const i = require('npm-i')
const fs = require('fs');
const reposNames = require('./repos');
const colors = require('colors');
const gitPrefix = "git@gitlab.com:greenapes/hkube/"


reposNames.forEach(repo => {
    let path = `${folder}${repo}`;
    let fullRepo = `${gitPrefix}${repo}`;
    try {
        if (!fs.existsSync(path)) {
            console.log(`clone is  started for ${fullRepo} to path: ${path}`.green);
            git.clone(fullRepo, null, path, (error, repo) => {
                console.log(`cloned successfully: ${fullRepo}`.green)
                // i({ path }, err => {
                //     if (err) throw err
                //     console.log(`${path} Installed dependencies!`.green)
                // })
            })
        }
        else {
            console.log(`${path} already exists`.green);
        }

    } catch (e) {
        console.log(`error:${e}`.green);
    }
});



