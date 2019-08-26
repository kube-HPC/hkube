#!/bin/bash

set -e

PACKAGES_REGISTRY=$1
PACKAGES_TOKEN=$2
REQUIRMENTS=./algorithm_unique_folder/requirements.txt
TRUSTED_HOST=pypi.python.org
# We use --extra-index-url to allow pip to keep the original Index URL. 
# This allows pip to implicitly install public packages that your private package may depend on.

if [ -f ${REQUIRMENTS} ]; then
     echo "found requirements.txt"
     if [[ ${PACKAGES_REGISTRY} != "" ]]; then
          PACKAGES_REGISTRY_HOST=$(echo $PACKAGES_REGISTRY | sed -e "s/[^/]*\/\/\([^@]*@\)\?\([^:/]*\).*/\2/")
          echo "found pip registry ${PACKAGES_REGISTRY}. Setting trusted host to ${PACKAGES_REGISTRY_HOST}"
          pip3 install --trusted-host ${PACKAGES_REGISTRY_HOST} --extra-index-url ${PACKAGES_REGISTRY} --trusted-host ${TRUSTED_HOST} -r ${REQUIRMENTS}
     else
          pip3 install --trusted-host ${TRUSTED_HOST} -r ${REQUIRMENTS}
     fi
else
     echo "no requirements.txt found"
fi