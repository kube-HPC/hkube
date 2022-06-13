ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.1.0-buster as install
ADD ./package-lock.json ./package.json /hkube/trigger-service/
WORKDIR /hkube/trigger-service
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.1-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/trigger-service
COPY --from=install /hkube/trigger-service/node_modules /hkube/trigger-service/node_modules
WORKDIR /hkube/trigger-service
CMD ["node", "app.js"]
