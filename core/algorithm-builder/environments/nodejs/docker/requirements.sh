#!/bin/bash

set -e

PACKAGES_REGISTRY=$1
PACKAGES_TOKEN=$2

if [[ ${PACKAGES_REGISTRY} != "" ]] && [[ ${PACKAGES_TOKEN} != "" ]]; then
    echo "found npm registry ${PACKAGES_REGISTRY} and token ...."
    echo "//${PACKAGES_REGISTRY}/:_authToken=${PACKAGES_TOKEN}" > .npmrc && \
    npm install && \
    rm -f .npmrc
else
     echo "no npm credentials found"
     npm install
fi

    

