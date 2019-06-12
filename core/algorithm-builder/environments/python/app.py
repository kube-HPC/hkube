from configs import config
import algorunner

def main():
    print("starting algorithm runner")
    alg = algorunner.Algorunner(config.Config)
    
    # data = {"input": [5]}
    # #data = {"input": [[2, 4, 3, 5, 1], 'asc']}
    # start(data)
    # alg._init(data)
    # result = alg._start(None)
    # alg._stop(data)
    # alg._exit(data)


if __name__ == "__main__":
    main()


