#!/bin/sh

set -e

PACKAGES_REGISTRY=$1
PACKAGES_TOKEN=$2

if [ ! -z ${PACKAGES_REGISTRY} ]; then
    echo "found npm registry ${PACKAGES_REGISTRY}"
    echo "//${PACKAGES_REGISTRY}/:_authToken=${PACKAGES_TOKEN}" > .npmrc && \
    npm install --registry=${PACKAGES_REGISTRY} && \
    rm -f .npmrc
else
     echo "no npm credentials found"
     npm install
fi

    

