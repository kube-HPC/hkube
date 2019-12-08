FROM tensorflow/tensorflow:latest-gpu-py3
COPY ./runTensorBoard.sh .
RUN /bin/bash -c 'chmod +x ./runTensorBoard.sh'
CMD ["bin/bash","./runTensorBoard.sh"]
