#!/bin/sh

set -e

export PACKAGES_REGISTRY=${packagesRegistry}
PACKAGES_REGISTRY_HOST=${PACKAGES_REGISTRY#http://}
export PACKAGES_REGISTRY_HOST=${PACKAGES_REGISTRY_HOST#https://}
export PACKAGES_TOKEN=${packagesToken}
export PACKAGES_AUTH=${packagesAuth}

if [ ! -z ${PACKAGES_REGISTRY} ]; then
    echo "found npm registry ${PACKAGES_REGISTRY}"
    if [ ! -z ${PACKAGES_TOKEN} ]; then
        echo "//${PACKAGES_REGISTRY_HOST}:_authToken=${PACKAGES_TOKEN}" > ${HOME}/.npmrc
    elif [ ! -z ${PACKAGES_AUTH} ]; then
        echo "//${PACKAGES_REGISTRY_HOST}:_auth=${PACKAGES_AUTH}" > ${HOME}/.npmrc
        echo "//${PACKAGES_REGISTRY_HOST}:always-auth=true" >> ${HOME}/.npmrc
    fi
fi
if [ ! -z ${dependency_install_cmd} ]; then
    echo "found dependency install script"
    SCRIPT_CWD="${PWD}"
    echo "running ${dependency_install_cmd} in folder ${SCRIPT_CWD}"
    sh -c "cd ${SCRIPT_CWD} && sh ${dependency_install_cmd}"
    echo "${dependency_install_cmd} execution done with code $?"
elif [ ! -z ${PACKAGES_REGISTRY} ]; then
    npm install --registry=${PACKAGES_REGISTRY}
    rm -f .npmrc
else
    echo "no npm credentials found"
    npm install
fi
