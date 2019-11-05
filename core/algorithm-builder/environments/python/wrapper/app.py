from __future__ import print_function, division, absolute_import
from configs import config
from hkube_python_wrapper import Algorunner

def main():
    print("starting algorithm runner")
    conf = config.Config
    alg = Algorunner()
    alg.loadAlgorithm(conf.algorithm)
    job=alg.connectToWorker(conf.socket)
    job.join()

if __name__ == "__main__":
    main()