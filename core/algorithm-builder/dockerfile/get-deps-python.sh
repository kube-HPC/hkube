#!/bin/bash
set -eo pipefail
SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"
mkdir -p $SCRIPTPATH/../environments/python/packages
versions="2.7 3.5 3.6 3.7"
for v in $versions
do
  echo downloading for python:$v
  docker run --rm -u $(id -u ${USER}):$(id -g ${USER}) -v $SCRIPTPATH/../environments/python/packages:/packages -v $SCRIPTPATH/../environments/python/wrapper:/wrapper python:$v pip wheel -w /packages -r /wrapper/requirements.txt
done