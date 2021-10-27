from __future__ import print_function, division, absolute_import

import sys

from hkube_python_wrapper import Algorunner
import optuna

_hkubeApi = None

study = optuna.create_study()


def start(options, hkubeApi):
    hyperParams = options['spec']['hyperParams']
    pipelineName = options['spec']['objectivePipeline']
    numberOfTrails = options['spec']['numberOfTrials']

    def objective(trial):
        return objectiveWrapped(trial, hkubeApi, hyperParams, pipelineName)

    study.optimize(objective, n_trials=numberOfTrails)
    study.best_params

    return study.best_params


def stop(options):
    try:
        study.stop()
    except:
        pass


def objectiveWrapped(trial, hkubeApi, hyperParams, pipelineName):
    values = {}
    for param in hyperParams:
        values[param['name']] = getattr(
            sys.modules[__name__], "suggest_%s" % param['suggest'])(param, trial)
    pipelineResult = hkubeApi.start_stored_subpipeline(
        pipelineName, {'hyperParams': values}, True)
    print('printed here' + str(pipelineResult))
    if (len(pipelineResult) == 0):
        raise Exception('objective pipeline has no result')
    if (isinstance(pipelineResult, str)):
        raise Exception(pipelineResult)
    result = pipelineResult[0]['result']
    if (isinstance(result, list)):
        result = result[0]
    return result


def suggest_uniform(param, trial):
    return trial.suggest_uniform(param['name'], param['low'], param['high'])


def suggest_int(param, trial):
    return trial.suggest_int(param['name'], param['low'], param['high'])


def suggest_loguniform(param, trial):
    return trial.suggest_loguniform(['name'], param['low'], param['high'])


def suggest_discrete_uniform(param, trial):
    return trial.suggest_discrete_uniform(param['name'], param['low'], param['high'])


def suggest_categorical(param, trial):
    return trial.suggest_uniform(param['name'], param['choices'])


def main():
    print("starting algorithm runner")
    print(str(Algorunner))
    Algorunner.Run(start=start, stop=stop)


if __name__ == "__main__":
    main()
