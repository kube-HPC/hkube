#!/bin/bash
set -xo pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
$DIR/docker-login.sh
# add more registries (space delimited) (in CI env for instance)
# export EXTRA_PRIVATE_REGISTRIES="ghcr.io/kube-hpc"
export EXTRA_PRIVATE_REGISTRIES=${EXTRA_PRIVATE_REGISTRIES}
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