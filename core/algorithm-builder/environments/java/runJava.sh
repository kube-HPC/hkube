if [ -z "${JAVA_MAX_MEM}" ]; then
  MAX_MEM="512M"
else
  MAX_MEM="${JAVA_MAX_MEM}"
fi
if [ -z "${JAVA_MIN_MEM}" ]; then
  MIN_MEM="256M"
else
  MIN_MEM="${JAVA_MIN_MEM}"
fi


java -Xms${MIN_MEM} -Xmx${MAX_MEM} -jar wrapper.jar algorithm_unique_folder/encapsulated-algorithm.jar  2>&1 |tee /hkube-logs/stdout.log