#!/bin/bash
set -eo pipefail
SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"
mkdir -p $SCRIPTPATH/../environments/python/packages
versions="python:3.8 python:3.9 python:3.10"
for v in $versions
do
  echo downloading for $v
  docker run --rm -u $(id -u ${USER}):$(id -g ${USER}) -v $SCRIPTPATH/../environments/python/packages:/packages -v $SCRIPTPATH/../environments/python/wrapper:/wrapper $v pip wheel -w /packages -r /wrapper/requirements.txt
done