FROM ${BASE_PRIVATE_REGISTRY}python:3.7
COPY . /hkube/algorithm-hyperparams-tuner
WORKDIR /hkube/algorithm-hyperparams-tuner
RUN pip install -r ./dockerfile/requirements.txt 
CMD ["python", "app.py"]