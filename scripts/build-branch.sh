#!/bin/bash

#####
# usage: from project main run ./scripts/build-brance.sh
# will create ./deployment/values-BRANCH_NAME-COUNTER.yaml values file
# to install: helm upgrade -i -f regular-values.yaml -f ./deployment/values-BRANCH_NAME-COUNTER.yaml hkube-dev/hkube 
#####
set -eo pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
export OUT_VALUES_DIR=${DIR}/../deployment/
export REPOS=$(lerna list)
export TRAVIS_PULL_REQUEST=true
export TRAVIS_PULL_REQUEST_BRANCH=$(git rev-parse --abbrev-ref HEAD)
export PREV_BUILD_ID=$(cat ${OUT_VALUES_DIR}BUILD_ID)
export PREV_BUILD_ID=${PREV_BUILD_ID:-"0"}
echo PREV_BUILD_ID=$PREV_BUILD_ID
export TRAVIS_JOB_NUMBER=${BUILD_ID:-$((PREV_BUILD_ID+1))}

export OUT_VALUES=${OUT_VALUES_DIR}values-${TRAVIS_PULL_REQUEST_BRANCH}.yaml
echo "" > ${OUT_VALUES}
echo ${TRAVIS_JOB_NUMBER}>${OUT_VALUES_DIR}/BUILD_ID
echo "building branch ${TRAVIS_PULL_REQUEST_BRANCH} with id ${TRAVIS_JOB_NUMBER}"
for REPO in ${REPOS}
do
    VERSION=v$(jq -r .version ./core/${REPO}/package.json)
    VERSION=${VERSION}-${TRAVIS_PULL_REQUEST_BRANCH}-${TRAVIS_JOB_NUMBER}
    echo building ${REPO}:${VERSION}
    export PRIVATE_REGISTRY=docker.io/hkube
    lerna run --scope $REPO build --stream
    yq n $(echo ${REPO}|tr '-' '_').image.tag ${VERSION} >> ${OUT_VALUES}

    echo "build done for ${REPO}"
done
echo "all builds done."