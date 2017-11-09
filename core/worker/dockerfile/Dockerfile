FROM node:8
MAINTAINER yehiyam@gmail.com
RUN apt update && apt install nano
RUN mkdir /sound-factory
COPY . /sound-factory/worker
WORKDIR /sound-factory/worker
CMD ["node", "app.js"]