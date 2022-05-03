ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.0.0 as install
ADD ./package-lock.json ./package.json /hkube/algorithm-queue/
WORKDIR /hkube/algorithm-queue
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.0-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/algorithm-queue
COPY --from=install /hkube/algorithm-queue/node_modules /hkube/algorithm-queue/node_modules
WORKDIR /hkube/algorithm-queue
CMD ["node", "app.js"]
