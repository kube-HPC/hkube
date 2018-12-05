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

port=$(EPHYMERAL_PORT)
alg=$1
ALGO_CWD=${ALGO_CWD:-"../algorunner"}
ALGO_COMMAND=${ALGO_COMMAND:-"node app"}

echo "WORKER_SOCKET_PORT=$port"
echo "ALGORITHM_TYPE=${alg}"
echo "METRICS_PORT=$METRICS_PORT"
echo "ALGO_CWD=$ALGO_CWD"
echo "ALGO_COMMAND=${ALGO_COMMAND}"

export BASE_LOGS_PATH=/tmp/logProxy/
export ALGORITHM_LOG_FILE_NAME=algorunner_${port}.log
export ALGORITHM_TYPE=${alg}
export WORKER_SOCKET_PORT=${port}
export DLL_PATH="../libStub/build/liblibStub.so"

mkdir -p ${BASE_LOGS_PATH}
node app worker& PID_LIST+=" $!";

pushd .
cd ${ALGO_CWD}
${ALGO_COMMAND} > ${BASE_LOGS_PATH}${ALGORITHM_LOG_FILE_NAME} 2>&1 & PID_LIST+=" $!"
popd
echo ${PID_LIST}
trap "kill $PID_LIST" SIGINT
wait $PID_LIST
