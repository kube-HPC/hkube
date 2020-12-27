#!/bin/bash
set -xeo pipefail
echo running ./scripts/test.sh
./scripts/test.sh
echo ./scripts/test.sh exited with code $?
echo running ./scripts/createVersion.sh
./scripts/createVersion.sh
echo ./scripts/createVersion.sh exited with code $?
echo running ./scripts/build.sh
./scripts/build.sh

