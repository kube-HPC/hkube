#!/bin/bash

set -e

if [ -f ./requirements.txt ]; then
     echo found requirements.txt
     pip3 install -r ./requirements.txt
else
     echo no requirements.txt found
fi