ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.0.0 as install
ADD ./package-lock.json ./package.json /hkube/resource-manager/
WORKDIR /hkube/resource-manager
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.0-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/resource-manager
COPY --from=install /hkube/resource-manager/node_modules /hkube/resource-manager/node_modules
WORKDIR /hkube/task-executor
CMD ["node", "app.js"]
