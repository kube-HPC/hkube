#!/bin/bash
set -xo pipefail
echo ${DOCKER_PASSWORD} | docker login --username yehiyam --password-stdin
echo ${CHANGED}
for REPO in ${CHANGED}
do
  echo ${REPO} changed. Running build
  export PRIVATE_REGISTRY=docker.io/hkube
  lerna run --scope $REPO --stream build
  echo lerna run --scope $REPO build exited with code $?
  echo "build done for ${REPO}"
done

echo "all builds done."