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
echo using port $port

#run_parallel "sleep 1" "sleep 2"
export alg=$1
export ALGO_COMMAND=${2:-"node ../algorunner/app"}
echo worker for algorithm ${alg}

export JOB_TYPE=${alg}
export WORKER_SOCKET_PORT=${port}
export DLL_PATH="../libStub/build/liblibStub.so"
run_parallel "node app worker" "${ALGO_COMMAND}"
#run_parallel "node app worker" "python3 ../algoPackage/wrapper/wrapper.py"
