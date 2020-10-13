if [ -z "${JAVA_MAX_MEM}" ]; then
  MAX_MEM="${JAVA_DERIVED_MEMORY}M"
else
  MAX_MEM="${JAVA_MAX_MEM}"
fi
if [ -z "${JAVA_MIN_MEM}" ]; then
  MIN_MEM="256M"
else
  MIN_MEM="${JAVA_MIN_MEM}"
fi
export LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:/usr/lib/x86_64-linux-gnu/jni/

java -Xms${MIN_MEM} -Xmx${MAX_MEM} -jar wrapper.jar algorithm_unique_folder/encapsulated-algorithm.jar  2>&1 |tee /hkube-logs/stdout.log