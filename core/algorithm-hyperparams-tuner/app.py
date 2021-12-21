from __future__ import print_function, division, absolute_import
import hyperparamsAlgorithm

from hkube_python_wrapper import Algorunner


def main():
    print("starting algorithm runner")
    print(str(Algorunner))
    Algorunner.Run(start=hyperparamsAlgorithm.start,
                   stop=hyperparamsAlgorithm.stop)


if __name__ == "__main__":
    main()
