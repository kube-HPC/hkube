#!/bin/sh

set -e

PACKAGES_REGISTRY=${packagesRegistry}
PACKAGES_REGISTRY_HOST=${PACKAGES_REGISTRY#http://}
PACKAGES_REGISTRY_HOST=${PACKAGES_REGISTRY_HOST#https://}
PACKAGES_TOKEN=${packagesToken}
PACKAGES_AUTH=${packagesAuth}

if [ ! -z ${PACKAGES_REGISTRY} ]; then
    echo "found npm registry ${PACKAGES_REGISTRY}"
    if [ ! -z ${PACKAGES_TOKEN} ]; then
        echo "//${PACKAGES_REGISTRY_HOST}:_authToken=${PACKAGES_TOKEN}" > ${HOME}/.npmrc
    elif [ ! -z ${PACKAGES_AUTH} ]; then
        echo "//${PACKAGES_REGISTRY_HOST}:_auth=${PACKAGES_AUTH}" > ${HOME}/.npmrc
        echo "//${PACKAGES_REGISTRY_HOST}:always-auth=true" >> ${HOME}/.npmrc
    fi
    npm install --registry=${PACKAGES_REGISTRY}
    rm -f .npmrc
else
    echo "no npm credentials found"
    npm install
fi
