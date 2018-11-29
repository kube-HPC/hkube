
FROM hkube/base-node:v1.0.0
LABEL maintainer="maty21@gmail.com"
RUN mkdir /hkube
COPY . /hkube/alg-example
RUN cd /hkube/alg-example
WORKDIR /hkube/alg-example
CMD ["node", "app.js"]
