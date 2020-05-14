from __future__ import print_function, division, absolute_import
import gevent
from hkube_python_wrapper import Algorunner
from configs import config
from gevent import monkey
monkey.patch_all()


def main():
    print("starting algorithm runner")
    alg = Algorunner()
    alg.loadAlgorithm(config.algorithm)
    jobs = alg.connectToWorker(config)
    gevent.joinall(jobs)


if __name__ == "__main__":
    main()
