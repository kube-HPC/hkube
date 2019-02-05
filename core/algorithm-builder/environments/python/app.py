from configs import config
import algorunner
import time


def main():
    print("starting algorithm runner")
    alg = algorunner.Algorunner(config.Config)


if __name__ == "__main__":
    main()