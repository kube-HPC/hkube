
ARG DOCKER_REGISTRY=""
FROM ${DOCKER_REGISTRY}hkube/base-node:v1.1.1
LABEL maintainer="yehiyam@gmail.com"

RUN mkdir /hkube
COPY . /hkube/algorithm-runner
RUN cd /hkube/algorithm-runner
WORKDIR /hkube/algorithm-runner

RUN npm i
CMD ["npm", "start"]