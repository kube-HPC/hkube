ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:14.5.0 as install
ADD ./package-lock.json ./package.json /hkube/datasource-service/
WORKDIR /hkube/datasource-service
RUN npm ci --production
RUN echo stam

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.1
LABEL maintainer="reggev.am@gmail.com"

RUN curl \
    https://dvc.org/deb/dvc.list \
    -L \
    --output /etc/apt/sources.list.d/dvc.list

RUN apt update && apt install -y git-all dvc && rm -rf /var/lib/apt/lists/*
RUN git config --global user.email "hkube@hkube.io" && git config --global user.name "hkube"
RUN mkdir -p /hkube/datasource-service
WORKDIR /hkube/datasource-service
COPY . /hkube/datasource-service
COPY --from=install /hkube/datasource-service/node_modules /hkube/datasource-service/node_modules
CMD ["node", "app"]
