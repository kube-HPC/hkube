
FROM ${DOCKER_PULL_REGISTRY}/base-algorithm-nodejs:v1.1.61
LABEL maintainer="yehiyam@gmail.com"

COPY . /hkube/algorithm-runner
WORKDIR /hkube/algorithm-runner/algorithm_unique_folder

RUN ../docker/requirements.sh

RUN cd /hkube/algorithm-runner
WORKDIR /hkube/algorithm-runner

CMD ["npm", "start"]
