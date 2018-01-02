FROM node:8-alpine
MAINTAINER yehiyam@gmail.com
RUN apk --update add nano && \
    rm -rf /var/cache/apk/*
RUN mkdir /hkube
COPY . /hkube/worker
RUN cd /hkube/worker && npm rebuild
WORKDIR /hkube/worker
CMD ["node", "app.js"]