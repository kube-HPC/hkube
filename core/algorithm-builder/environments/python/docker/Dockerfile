ARG DOCKER_REGISTRY=""
FROM ${DOCKER_REGISTRY}python:3
LABEL maintainer="yehiyam@gmail.com"
LABEL description="This is a base algorithm for Python env"

RUN mkdir /hkube
COPY . /hkube/algorithm-runner
RUN cd /hkube/algorithm-runner
WORKDIR /hkube/algorithm-runner

RUN pip3 install -r requirements.txt
CMD ["python3", "-u", "app.py"]