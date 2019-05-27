#!/bin/bash

set -e

if [ -f ./algorithm_unique_folder/requirements.txt ]; then
     echo found requirements.txt
     pip3 install -r ./algorithm_unique_folder/requirements.txt
else
     echo no requirements.txt found
fi