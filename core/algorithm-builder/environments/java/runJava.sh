ALGORITHM_MEMORY=${ALGORITHM_MEMORY/Ki/K}
ALGORITHM_MEMORY=${ALGORITHM_MEMORY/Mi/M}
ALGORITHM_MEMORY=${ALGORITHM_MEMORY/Gi/G}
ALGORITHM_MEMORY=${ALGORITHM_MEMORY/Ti/T}
# Algorithm memory can be set as Decimal/Binary units as X/Xi (where X can be m,K,M,G,T,P,E)
# Java memory can only be set as binary units. So X and Xi are treated the same when deriving java memory.
# Java memory supports K,M,G,T.
# If the Algorithm memory is set using m,P,E, then
# java memory values have to be set using JAVA_MAX_MEM JAVA_MIN_MEM environment variables.
#
if [ -z "${JAVA_MAX_MEM}" ]; then
  MAX_MEM="${ALGORITHM_MEMORY//[^[:digit:]]/}"
  MAX_MEM="$(($MAX_MEM* 7 / 4))${ALGORITHM_MEMORY//[^[:alpha:]]/}"
else
  MAX_MEM="${JAVA_MAX_MEM}"
fi
if [ -z "${JAVA_MIN_MEM}" ]; then
  MIN_MEM="${ALGORITHM_MEMORY//[^[:digit:]]/}"
  MIN_MEM="$(($MIN_MEM / 2))${ALGORITHM_MEMORY//[^[:alpha:]]/}"
else
  MIN_MEM="${JAVA_MIN_MEM}"
fi


java -Xms${MIN_MEM} -Xmx${MAX_MEM} -jar wrapper.jar algorithm_unique_folder/encapsulated-algorithm.jar  2>&1 |tee /hkube-logs/stdout.log