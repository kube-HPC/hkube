ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.1.0-buster as install
ADD ./package-lock.json ./package.json /hkube/algorithm-debug/
WORKDIR /hkube/algorithm-debug
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.1-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/algorithm-debug
COPY --from=install /hkube/algorithm-debug/node_modules /hkube/algorithm-debug/node_modules
WORKDIR /hkube/algorithm-debug
CMD ["node", "app.js"]