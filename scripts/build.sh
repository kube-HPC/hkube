#!/bin/bash
set -eo pipefail
if ([ "$TRAVIS_BRANCH" == "master" ] || [ ! -z "$TRAVIS_TAG" ]) && [ "$TRAVIS_PULL_REQUEST" == "false" ]; then
  echo ${DOCKER_HUB_PASS} | docker login --username yehiyam --password-stdin
  echo ${CHANGED}
  for REPO in ${CHANGED}
  do
    echo ${REPO} changed. Running build
    export PRIVATE_REGISTRY=docker.io/hkube
    lerna run --scope $REPO build
    echo "build done for ${REPO}"
  done
else
    echo "version skiped!"
fi
echo "all builds done."