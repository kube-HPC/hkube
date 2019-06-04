#!/bin/bash
set -ev
echo ${CHANGED}
for REPO in ${CHANGED}
do
  echo ${REPO} changed. Running tests
  lerna run --scope $REPO lint
  lerna run --scope $REPO test
done