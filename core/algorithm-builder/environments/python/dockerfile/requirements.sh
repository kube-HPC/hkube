#!/bin/sh

set -e

PACKAGES_REGISTRY=$1
PACKAGES_TOKEN=$2
REQUIRMENTS=./algorithm_unique_folder/requirements.txt
TRUSTED_HOST=pypi.python.org
# install hkube + dependencies
echo install hkube + dependencies
if [ ! -z ${PACKAGES_REGISTRY} ]; then
     PACKAGES_REGISTRY_HOST=$(echo $PACKAGES_REGISTRY | sed -e "s/[^/]*\/\/\([^@]*@\)\?\([^:/]*\).*/\2/")
     echo "found pip registry ${PACKAGES_REGISTRY}. Setting trusted host to ${PACKAGES_REGISTRY_HOST}"
     pip install --trusted-host "${PACKAGES_REGISTRY_HOST}" --index-url "${PACKAGES_REGISTRY}" --find-links /hkube/packages/ -r /hkube/algorithm-runner/requirements.txt
else
  pip install --find-links /hkube/packages/ -r /hkube/algorithm-runner/requirements.txt
fi

if [ -f ${REQUIRMENTS} ]; then
     echo "found requirements.txt"
     if [ ! -z ${PACKAGES_REGISTRY} ]; then
          PACKAGES_REGISTRY_HOST=$(echo $PACKAGES_REGISTRY | sed -e "s/[^/]*\/\/\([^@]*@\)\?\([^:/]*\).*/\2/")
          echo "found pip registry ${PACKAGES_REGISTRY}. Setting trusted host to ${PACKAGES_REGISTRY_HOST}"
          pip install --trusted-host "${PACKAGES_REGISTRY_HOST}" --index-url "${PACKAGES_REGISTRY}" -r "${REQUIRMENTS}"
     else
          pip install --trusted-host "${TRUSTED_HOST}" -r "${REQUIRMENTS}"
     fi
else
     echo "no requirements.txt found"
fi