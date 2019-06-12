#!/usr/bin/env bash


dockerLogin() {
  if [[ ${DOCKER_REGISTRY_PASS} != "" ]]; then 
    echo "Found docker password, docker login...."
    echo ${DOCKER_REGISTRY_PASS} | docker login --username ${DOCKER_REGISTRY_USER} --password-stdin
  else
    echo "Didn't find docker password, skip login...."
  fi
}

dockerBuild() {
  docker build \
  --force-rm \
  --network=host \
  -t ${IMAGE_NAME} \
  -f ${BUILD_PATH}/docker/Dockerfile ${BUILD_PATH}
}