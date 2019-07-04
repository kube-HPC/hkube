#!/bin/bash

set -e

PACKAGES_REGISTRY=$1
PACKAGES_TOKEN=$2
REQUIRMENTS=./algorithm_unique_folder/requirements.txt

# We use --extra-index-url to allow pip to keep the original Index URL. 
# This allows pip to implicitly install public packages that your private package may depend on.

if [ -f ${REQUIRMENTS} ]; then
     echo "found requirements.txt"
     if [[ ${PACKAGES_REGISTRY} != "" ]]; then
          echo "found pip registry ${PACKAGES_REGISTRY}"
          pip3 install --extra-index-url ${PACKAGES_REGISTRY} -r ${REQUIRMENTS}
     else
          pip3 install -r ${REQUIRMENTS}
     fi
else
     echo "no requirements.txt found"
fi