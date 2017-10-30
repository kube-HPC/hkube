FROM node:latest
MAINTAINER yehiyam@gmail.com
RUN apt update && apt install nano
RUN mkdir /sound-factory && npm install -g nodemon
COPY . /sound-factory/worker
WORKDIR /sound-factory/worker
CMD ["nodemon", "app.js"]