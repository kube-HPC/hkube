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

mkfifo /tmp/pipe; (tee -a /var/log/etcd.log < /tmp/pipe & ) ; exec java -Xms${MIN_MEM} -Xmx${MAX_MEM} -Dcom.amazonaws.sdk.disableCertChecking=true -jar wrapper.jar algorithm_unique_folder/encapsulated-algorithm.jar > /tmp/pipe 2>&1