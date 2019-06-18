#!/usr/bin/env bash

# This script used to create a specific algorithm image

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
    DOCKER_PULL_REGISTRY="$2"
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

    *)
    usage
    exit 1
esac
done

echo
echo IMAGE_NAME=${IMAGE_NAME}
echo BUILD_PATH=${BUILD_PATH}
echo DOCKER_PULL_REGISTRY=${DOCKER_PULL_REGISTRY}
echo DOCKER_PUSH_REGISTRY=${DOCKER_PUSH_REGISTRY}
echo REMOVE_IMAGE=${REMOVE_IMAGE}
echo

echo docker version
docker version
echo

echo Operating System Details
cat /etc/os-release
echo

echo
dockerLogin ${DOCKER_PULL_USER} ${DOCKER_PULL_PASS}
echo

echo
DOCKER_PULL_REGISTRY=${DOCKER_PULL_REGISTRY} envsubst < ${BUILD_PATH}/docker/DockerfileTemplate > ${BUILD_PATH}/docker/${DOCKER_FILE}
echo

echo
dockerBuild ${IMAGE_NAME} ${BUILD_PATH} ${DOCKER_FILE}
echo

echo
dockerLogin ${DOCKER_PUSH_USER} ${DOCKER_PUSH_PASS}
echo

echo
dockerPush ${IMAGE_NAME}
echo

echo
removeImage ${IMAGE_NAME} ${REMOVE_IMAGE}
echo