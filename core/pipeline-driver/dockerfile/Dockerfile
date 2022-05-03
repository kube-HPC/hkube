ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.0.0 as install
ADD ./package-lock.json ./package.json /hkube/pipeline-driver/
WORKDIR /hkube/pipeline-driver
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.0-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/pipeline-driver
COPY --from=install /hkube/pipeline-driver/node_modules /hkube/pipeline-driver/node_modules
WORKDIR /hkube/pipeline-driver
CMD ["node", "app.js"]
