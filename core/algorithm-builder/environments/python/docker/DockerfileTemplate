
FROM ${DOCKER_PULL_REGISTRY}/base-algorithm-python:v1.1.61
LABEL maintainer="hkube.dev@gmail.com"

COPY . /hkube/algorithm-runner
RUN cd /hkube/algorithm-runner
WORKDIR /hkube/algorithm-runner

RUN ./docker/requirements.sh

ENV PYTHONPATH=$PYTHONPATH:/hkube/algorithm-runner/algorithm_unique_folder
CMD ["python3", "-u", "app.py"]
