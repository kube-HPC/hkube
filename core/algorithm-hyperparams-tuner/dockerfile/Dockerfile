FROM ${BASE_PRIVATE_REGISTRY}python:3.7
ADD ./requirements.txt /hkube/algorithm-hyperparams-tuner/dockerfile/requirements.txt
WORKDIR /hkube/algorithm-hyperparams-tuner
RUN pip install -r ./dockerfile/requirements.txt 
RUN mkdir -p /hkube-logs
COPY . /hkube/algorithm-hyperparams-tuner
CMD ["/bin/sh", "-c", "python -u app.py 2>&1 |tee /hkube-logs/stdout.log"]