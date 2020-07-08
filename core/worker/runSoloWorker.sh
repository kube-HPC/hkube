#!/bin/bash

export $(cat ~/dev/env/.env); 
export port=$2
echo "using port $port"
echo "METRICS_PORT $METRICS_PORT"

export alg=$1


echo "worker for algorithm ${alg}"

export ALGORITHM_TYPE=${alg}
export WORKER_SOCKET_PORT=${port}
export BASE_LOGS_PATH=/tmp/logProxy/
mkdir -p ${BASE_LOGS_PATH}
export DLL_PATH="../libStub/build/liblibStub.so"
node app worker& PID_LIST+=" $!";

echo ${PID_LIST}
trap "kill $PID_LIST" SIGINT
wait $PID_LIST
