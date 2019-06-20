ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.1.1
LABEL maintainer="hkube.dev@gmail.com"

ENV DOCKER_CHANNEL 'stable'
ENV DOCKER_VERSION '18.09.1'
ENV DOCKER_ARCH 'x86_64'

RUN set -eux; \
	\
	if ! wget -O docker.tgz "https://download.docker.com/linux/static/${DOCKER_CHANNEL}/${DOCKER_ARCH}/docker-${DOCKER_VERSION}.tgz"; then \
	echo >&2 "error: failed to download 'docker-${DOCKER_VERSION}' from '${DOCKER_CHANNEL}' for '${DOCKER_ARCH}'"; \
	exit 1; \
	fi; \
	\
	tar --extract \
	--file docker.tgz \
	--strip-components 1 \
	--directory /usr/local/bin/ \
	; \
	rm docker.tgz; \
	\
	dockerd --version; \
	docker --version

RUN apt install gettext-base

RUN mkdir /hkube
COPY . /hkube/algorithm-builder
RUN cd /hkube/algorithm-builder
WORKDIR /hkube/algorithm-builder
CMD ["npm", "start"]