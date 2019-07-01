#!/usr/bin/env bash

# This script used to create a specific algorithm image
set -e
source $PWD/lib/builds/build-utils.sh

DOCKER_FILE="__DockerFile__"

while [[ $# -gt 0 ]]
do
key="$1"

case $key in
    --img)
    IMAGE_NAME="$2"
    shift
    shift
    ;;

    --buildpath)
    BUILD_PATH="$2"
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
echo DOCKER_PULL_REGISTRY=${DOCKER_PULL_REGISTRY}
echo DOCKER_PUSH_REGISTRY=${DOCKER_PUSH_REGISTRY}
echo REMOVE_IMAGE=${REMOVE_IMAGE}
echo TMP_FOLDER=${TMP_FOLDER}
echo

# echo
# dockerLogin ${DOCKER_PULL_USER} ${DOCKER_PULL_PASS} ${DOCKER_PULL_REGISTRY}
# dockerLogin ${DOCKER_PUSH_USER} ${DOCKER_PUSH_PASS} ${DOCKER_PUSH_REGISTRY}
# echo

echo
envsubst < ${BUILD_PATH}/docker/DockerfileTemplate > ${BUILD_PATH}/docker/${DOCKER_FILE}
echo

echo
dockerBuildKaniko ${IMAGE_NAME} ${BUILD_PATH} ${DOCKER_FILE} ${TMP_FOLDER}/workspace ${TMP_FOLDER}/commands
ret=${exit_code}
echo build finished with code $ret
echo

exit $ret
