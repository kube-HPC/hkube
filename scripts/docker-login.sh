echo login to docker.io
echo ${DOCKER_PASSWORD} | docker login --username ${DOCKER_USER} --password-stdin
# set extra docker credentials in EXTRA_DOCKER_LOGINS env. format: registry::username::password (space delimited)
for EXTRA_LOGIN in $EXTRA_DOCKER_LOGINS; do
    args=(${EXTRA_LOGIN//::/ })
    echo login to ${args[0]}
    echo ${args[2]} | docker login ${args[0]} --username ${args[1]} --password-stdin
done