FROM ${BASE_PRIVATE_REGISTRY}python:3.7
COPY . /hkube/algorithm-optimizer
WORKDIR /hkube/algorithm-optimizer
RUN pip install -r ./dockerfile/requirements.txt 
CMD ["python", "app.py"]