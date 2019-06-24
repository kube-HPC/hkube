from configs import config
from hkube_python_wrapper import Algorunner

def main():
    print("starting algorithm runner")
    conf = config.Config
    alg = Algorunner()
    alg.loadAlgorithm(conf.algorithm)
    alg.connectToWorker(conf.socket)

if __name__ == "__main__":
    main()