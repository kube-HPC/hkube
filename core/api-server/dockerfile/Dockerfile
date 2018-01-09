FROM node:8-alpine
MAINTAINER yehiyam@gmail.com
RUN apk --update add nano && \
    rm -rf /var/cache/apk/*
RUN mkdir /hkube
COPY . /hkube/api-server
RUN cd /hkube/api-server && npm rebuild
WORKDIR /hkube/api-server
CMD ["node", "app.js"]