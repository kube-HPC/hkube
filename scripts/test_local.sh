#!/bin/bash
set -e
export CHANGED=$(lerna changed)
echo ${CHANGED}
for REPO in ${CHANGED}
do
  echo ${REPO} changed. Running tests
  lerna run --scope $REPO lint
  echo lint for $REPO returned $?
  lerna run --scope $REPO test
  echo test for $REPO returned $?
done