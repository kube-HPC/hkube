#!/bin/bash

function EPHYMERAL_PORT(){
    LPORT=32768;
    UPORT=60999;
    while true; do
        MPORT=$[$LPORT + ($RANDOM % $UPORT)];
        (echo "" >/dev/tcp/127.0.0.1/${MPORT}) >/dev/null 2>&1
        if [ $? -ne 0 ]; then
            echo $MPORT;
            return 0;
        fi
    done
}

ENV_FILE=~/dev/env/.env

if [[ -z "${VEVN}" ]]; then
    echo "no VENV"
else
    VIRTUAL_ENV=~/$VEVN/bin/activate
    echo "using virtual env $VIRTUAL_ENV"
    source $VIRTUAL_ENV
fi

if [[ -f "$ENV_FILE" ]]; then
    echo "using env file ${ENV_FILE}"
    export $(cat ~/dev/env/.env); 
fi

export WORKER_SOCKET_PORT=$(EPHYMERAL_PORT)
export DISCOVERY_PORT=$(EPHYMERAL_PORT)
export STREAMING_DISCOVERY_PORT=$(EPHYMERAL_PORT)
export METRICS_PORT=$(EPHYMERAL_PORT)
# export POD_NAME="alg-${WORKER_SOCKET_PORT}"
export ALGORITHM_TYPE=${ALG_TYPE}


echo "WORKER_SOCKET_PORT=$WORKER_SOCKET_PORT"
echo "ALGORITHM_TYPE=$ALGORITHM_TYPE"
echo "METRICS_PORT=$METRICS_PORT"
echo "ALGO_CWD=$ALGO_CWD"
echo "ALGO_CMD=${ALGO_CMD}"

export BASE_LOGS_PATH=/tmp/logProxy/
export ALGORITHM_LOG_FILE_NAME=algorunner_${WORKER_SOCKET_PORT}.log
export DLL_PATH="../libStub/build/liblibStub.so"

mkdir -p ${BASE_LOGS_PATH}

node app worker& PID_LIST+=" $!";

pushd .
cd ${ALGO_CWD}
${ALGO_CMD} 

#> ${BASE_LOGS_PATH}${ALGORITHM_LOG_FILE_NAME} 2>&1 & PID_LIST+=" $!"

popd
echo ${PID_LIST}
trap "kill $PID_LIST" SIGINT
wait $PID_LIST
