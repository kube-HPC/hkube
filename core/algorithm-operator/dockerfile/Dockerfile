ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.1.0-buster as install
ADD ./package-lock.json ./package.json /hkube/algorithm-operator/
WORKDIR /hkube/algorithm-operator
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.1-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/algorithm-operator
COPY --from=install /hkube/algorithm-operator/node_modules /hkube/algorithm-operator/node_modules
WORKDIR /hkube/algorithm-operator
CMD ["node", "app.js"]
