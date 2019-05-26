#!/bin/bash

set -e

if [ -f ./algorithm/requirements.txt ]; then
     echo found requirements.txt
     pip3 install -r ./algorithm/requirements.txt
else
     echo no requirements.txt found
fi