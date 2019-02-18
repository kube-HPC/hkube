from configs import config
import algorunner
import time

def main():
    print("starting algorithm runner")
    alg = algorunner.Algorunner(config.Config)

    # time.sleep(1)
    # data = {"input": [[2, 4, 3, 5, 1], 'asc']}
    # alg._init(data)
    # result = alg._start(None)
    # alg._stop(data)
    # alg._exit(data)


if __name__ == "__main__":
    main()