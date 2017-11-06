#!/usr/bin/env node

let folder = `${process.env.HOME}/dev/hkube/`
const i = require('npm-i')
const fs = require('fs');
const colors = require('colors');
const reposNames = require('./repos');



reposNames.forEach(repo => {
    let path = `${folder}${repo}`;
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



