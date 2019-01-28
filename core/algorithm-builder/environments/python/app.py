from configs import config
from src import algorunner

if __name__ == "__main__":
    print("starting algorithm runner")
    algorunner.Algorunner(config.Config)