ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.0.0 as install
ADD ./package-lock.json ./package.json /hkube/gc-service/
WORKDIR /hkube/gc-service
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.0-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/gc-service
COPY --from=install /hkube/gc-service/node_modules /hkube/gc-service/node_modules
WORKDIR /hkube/gc-service
CMD ["node", "app.js"]