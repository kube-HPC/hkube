if [ -z "${JAVA_MAX_MEM}" ]; then
  MAX_MEM="512M"
else
  MAX_MEM="${JAVA_MAX_MEM}"
fi
java -Xmx${MAX_MEM} -jar wrapper.jar algorithm_unique_folder/encapsulated-algorithm.jar  2>&1 |tee /hkube-logs/stdout.log