#!/bin/sh

set -e
echo "$@"
if [ "${DEV_MODE}" = "true"  ]; then
    exec /hkube/nodemon --watch /hkube/algorithm-runner/algorithm_unique_folder/ --ignore *.pyc  -L --ext '*' --delay 2 -x  "$@"
else
    exec "$@"
fi