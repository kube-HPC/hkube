ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.1.0-buster as install
ADD ./package-lock.json ./package.json /hkube/task-executor/
WORKDIR /hkube/task-executor
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.1-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/task-executor
COPY --from=install /hkube/task-executor/node_modules /hkube/task-executor/node_modules
WORKDIR /hkube/task-executor
CMD ["node", "app.js"]
