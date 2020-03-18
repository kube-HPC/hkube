from hkube_python_wrapper import Algorunner
from configs import config
from gevent import monkey
monkey.patch_all()


def main():
    print("starting algorithm runner")
    conf = config.Config
    alg = Algorunner()
    alg.loadAlgorithm(conf.algorithm)
    job = alg.connectToWorker(conf)
    job.join()


if __name__ == "__main__":
    main()
