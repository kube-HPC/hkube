#!/bin/bash
set -eo pipefail
./scripts/test.sh
./scripts/createVersion.sh
./scripts/build.sh
./scripts/trigger.js