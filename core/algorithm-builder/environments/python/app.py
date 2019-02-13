from configs import config
import algorunner


def main():
    print("starting algorithm runner")
    alg = algorunner.Algorunner(config.Config)

    # data = {"input": [1, 2, 3, 4, 5]}
    # alg._start(data)
    # alg._start(data)
    # alg._stop(data)
    # alg._exit(data)


if __name__ == "__main__":
    main()