#!/usr/bin/env bash

# This script used to create a specific algorithm image
set -e

source $PWD/lib/builds/build-utils.sh

#myVar=$(sed -n '/^nodejs=\(.*\)$/s//\1/p' base-versions)

while [[ $# -gt 0 ]]
do
key="$1"

case $key in
    --img)
    IMAGE_NAME="$2"
    shift
    shift
    ;;

    --buildPath)
    BUILD_PATH="$2"
    shift
    shift
    ;;

    --baseImage)
    BASE_IMAGE="$2"
    shift
    shift
    ;;

    --dplr)
    export DOCKER_PULL_REGISTRY="$2"
    shift
    shift
    ;;

    --dplu)
    DOCKER_PULL_USER="$2"
    shift
    shift
    ;;

    --dplp)
    DOCKER_PULL_PASS="$2"
    shift
    shift
    ;;

    --dphr)
    DOCKER_PUSH_REGISTRY="$2"
    shift
    shift
    ;;

    --dphu)
    DOCKER_PUSH_USER="$2"
    shift
    shift
    ;;

    --dphp)
    DOCKER_PUSH_PASS="$2"
    shift
    shift
    ;;

    --pckr)
    PACKAGES_REGISTRY="$2"
    shift
    shift
    ;;

    --pckt)
    PACKAGES_TOKEN="$2"
    shift
    shift
    ;;

    --pcku)
    PACKAGES_USERNAME="$2"
    shift
    shift
    ;;

    --pckp)
    PACKAGES_PASSWORD="$2"
    shift
    shift
    ;;

    --rmi)
    REMOVE_IMAGE="$2"
    shift
    shift
    ;;

    --tmpFolder)
    TMP_FOLDER="$2"
    shift
    shift
    ;;

    --help)
    usage
    exit 1
esac
done

TMP_FOLDER=${TMP_FOLDER:-/tmp}
echo
echo IMAGE_NAME=${IMAGE_NAME}
echo BUILD_PATH=${BUILD_PATH}
echo BASE_IMAGE=${BASE_IMAGE}
echo DOCKER_PULL_REGISTRY=${DOCKER_PULL_REGISTRY}
echo DOCKER_PUSH_REGISTRY=${DOCKER_PUSH_REGISTRY}
echo PACKAGES_REGISTRY=${PACKAGES_REGISTRY}
echo REMOVE_IMAGE=${REMOVE_IMAGE}
echo TMP_FOLDER=${TMP_FOLDER}
echo

echo
dockerBuildKaniko "${IMAGE_NAME}" "${BUILD_PATH}" "${TMP_FOLDER}/workspace" "${TMP_FOLDER}/commands" "${BASE_IMAGE}" "${PACKAGES_REGISTRY}" "${PACKAGES_TOKEN}" ${DOCKER_PUSH_REGISTRY}
ret=${exit_code}
echo build finished with code $ret
echo

exit $ret
