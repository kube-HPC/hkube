ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.1.0-buster as install
ADD ./package-lock.json ./package.json /hkube/api-server/
WORKDIR /hkube/api-server
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.1-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/api-server
COPY --from=install /hkube/api-server/node_modules /hkube/api-server/node_modules
WORKDIR /hkube/api-server
CMD ["node", "app.js"]