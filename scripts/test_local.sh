#!/bin/bash
set -e
export CHANGED=$(git status -s --porcelain=v1 ./core | awk '{print $2}'|cut -f2 -d'/'|sort|uniq)
echo changed: ${CHANGED}
for REPO in ${CHANGED}
do
  echo ${REPO} changed. Running tests
  lerna run --scope $REPO lint
  echo lint for $REPO returned $?
  lerna run --scope $REPO --stream test
  echo test for $REPO returned $?
done