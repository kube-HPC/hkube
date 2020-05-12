#!/bin/bash
set -eo pipefail
export REPOS=$(lerna list)
export TRAVIS_PULL_REQUEST=true
export TRAVIS_PULL_REQUEST_BRANCH=$(git rev-parse --abbrev-ref HEAD)
export TRAVIS_JOB_NUMBER=${BUILD_ID:-"0"}
echo "building branch ${TRAVIS_PULL_REQUEST_BRANCH} with id ${TRAVIS_JOB_NUMBER}"
for REPO in ${REPOS}
do
    echo ${REPO} changed. Running build
    # export PRIVATE_REGISTRY=docker.io/hkube
    lerna run --scope $REPO build
    echo "build done for ${REPO}"
done
echo "all builds done."