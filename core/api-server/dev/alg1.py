from __future__ import print_function, division, absolute_import
from hkube_python_wrapper import Algorunner
import time 
def start(args, hkubeapi):
    for i in range(5):
        print('waiting',i)
        time.sleep(1)
    return 'foo'

if __name__ == "__main__":
    Algorunner.Run(start=start) 




