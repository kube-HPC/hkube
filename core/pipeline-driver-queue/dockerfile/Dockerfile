ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.0.0 as install
ADD ./package-lock.json ./package.json /hkube/pipeline-driver-queue/
WORKDIR /hkube/pipeline-driver-queue
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.0-buster
LABEL maintainer="maty21@gmail.com"
RUN mkdir /hkube
COPY . /hkube/pipeline-driver-queue
COPY --from=install /hkube/pipeline-driver-queue/node_modules /hkube/pipeline-driver-queue/node_modules
WORKDIR /hkube/pipeline-driver-queue
CMD ["node", "app.js"]
