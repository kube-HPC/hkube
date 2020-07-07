ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.0
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/task-executor
RUN cd /hkube/task-executor
WORKDIR /hkube/task-executor
CMD ["node", "app.js"]
