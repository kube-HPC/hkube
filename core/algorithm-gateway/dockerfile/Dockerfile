ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:16.15.0 as install
ADD ./package-lock.json ./package.json /hkube/algorithm-gateway/
WORKDIR /hkube/algorithm-gateway
RUN npm ci --production


ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.0
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/algorithm-gateway
COPY --from=install /hkube/algorithm-gateway/node_modules /hkube/algorithm-gateway/node_modules
WORKDIR /hkube/algorithm-gateway
CMD ["node", "app.js"]