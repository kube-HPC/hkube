
ARG BASE_PRIVATE_REGISTRY=""
ARG ALGORITHM_PATH

FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.1.0
LABEL maintainer="yehiyam@gmail.com"

pip3 install -r 
RUN mkdir /hkube
COPY ${ALGORITHM_PATH} /hkube/algorithm-runner
RUN cd /hkube/algorithm-runner
WORKDIR /hkube/algorithm-runner
CMD ["npm", "start"]
