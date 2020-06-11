#!/bin/bash

run_parallel () {
    for cmd in "$@"; do {
      echo "Process \"$cmd\" started";
      $cmd & pid=$!
      PID_LIST+=" $pid";
    } done

    trap "kill $PID_LIST" SIGINT

    echo "Parallel processes have started";

    wait $PID_LIST

    echo
    echo "All processes have completed";

}

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

export port=$(EPHYMERAL_PORT)
echo "using port $port"
echo "METRICS_PORT $METRICS_PORT"

export alg=$1
export ALGO_COMMAND=${2:-"node ../algorunner/app"}
echo "Running ${ALGO_COMMAND}"
export ALGORITHM_LOG_FILE_NAME=algorunner_${port}.log
echo "worker for algorithm ${alg}"

export ALGORITHM_TYPE=${alg}
export WORKER_SOCKET_PORT=${port}
export BASE_LOGS_PATH=/tmp/logProxy/
mkdir -p ${BASE_LOGS_PATH}
export DLL_PATH="../libStub/build/liblibStub.so"
node app worker& PID_LIST+=" $!";
${ALGO_COMMAND} > ${BASE_LOGS_PATH}${ALGORITHM_LOG_FILE_NAME} 2>&1 & PID_LIST+=" $!"
echo ${PID_LIST}
trap "kill $PID_LIST" SIGINT
wait $PID_LIST
