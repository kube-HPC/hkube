from configs import config
from hkube_python_wrapper import Algorunner

def main():
    print("starting algorithm runner")
    alg = Algorunner(config.Config)

if __name__ == "__main__":
    main()