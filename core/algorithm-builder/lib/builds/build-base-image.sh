#!/usr/bin/env bash

# This script used to create a specific base algorithm

source $PWD/lib/builds/build-utils.sh

usage(){
    echo "usage: [-e --env ] | [-v --ver] | -h --help]"
}

while [[ $# -gt 0 ]]
do
key="$1"

case $key in
    -e|--env)
    ENV="$2"
    shift
    shift
    ;;
    -v|--ver)
    VER="$2"
    shift
    shift
    ;;
    -h|--help)
    usage
    exit 1
    ;;
    *)
    usage
    exit 1
esac
done

NPM_VERSION=${npm_package_version}
VERSION="${VER:=${NPM_VERSION}}"
BUILD_PATH="environments/${ENV}"
IMAGE_NAME="hkube/${ENV}-env:${VERSION}"
DOCKER_FILE="Dockerfile"

if [ -z ${ENV} ]; then
  echo "Please choose env (python, nodejs, go)"
  exit -1
fi

echo IMAGE_NAME=${IMAGE_NAME}
echo DOCKER_REGISTRY=${DOCKER_REGISTRY}
echo BUILD_PATH=${BUILD_PATH}

echo
DOCKER_PULL_USER=${DOCKER_PULL_USER:-"none"}
DOCKER_PULL_PASS=${DOCKER_PULL_PASS:-"none"}
dockerLogin ${DOCKER_PULL_USER} ${DOCKER_PULL_PASS}
echo

dockerBuild ${IMAGE_NAME} ${BUILD_PATH} ${DOCKER_FILE}

dockerPush ${IMAGE_NAME}

removeImage ${IMAGE_NAME}

echo "update version in base-versions ${ENV}=${VERSION}"
sed -i "s/^\(${ENV}\s*=\s*\).*\$/\1$1${VERSION}/" $PWD/lib/builds/base-versions