ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.1.0-buster as install
ADD ./package-lock.json ./package.json /hkube/resource-manager/
WORKDIR /hkube/resource-manager
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.1-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/resource-manager
COPY --from=install /hkube/resource-manager/node_modules /hkube/resource-manager/node_modules
WORKDIR /hkube/resource-manager
CMD ["node", "app.js"]
