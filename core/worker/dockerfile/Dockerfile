FROM node:latest
MAINTAINER yehiyam@gmail.com

RUN mkdir /sound-factory && npm install -g nodemon
COPY . /sound-factory/worker
WORKDIR /sound-factory/worker
CMD ["nodemon", "app.js"]