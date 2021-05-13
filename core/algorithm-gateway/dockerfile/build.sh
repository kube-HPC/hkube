#!/usr/bin/env bash
REPO_NAME=$1
if [ -v PRIVATE_REGISTRY ]
then
  IMAGE_NAME=${PRIVATE_REGISTRY}/${REPO_NAME}
else
  IMAGE_NAME=hkube/${REPO_NAME}
fi
echo npm_package_version=${npm_package_version}
VERSION="v${npm_package_version}"
if [ "${TRAVIS_PULL_REQUEST:-"false"}" != "false" ]; then
  VERSION=${VERSION}-${TRAVIS_PULL_REQUEST_BRANCH}-${TRAVIS_JOB_NUMBER}
fi
TAG_VER="${IMAGE_NAME}:${VERSION}"

if [ -v BASE_PRIVATE_REGISTRY ]
then
  BASE_PRIVATE_REGISTRY="${BASE_PRIVATE_REGISTRY}/"
fi
docker build -t ${TAG_VER} --build-arg BASE_PRIVATE_REGISTRY="${BASE_PRIVATE_REGISTRY}" -f ./dockerfile/Dockerfile .

if [ -v PRIVATE_REGISTRY ]
then
  echo docker push ${TAG_VER}
  docker push ${TAG_VER}
fi

