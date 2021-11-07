from __future__ import print_function, division, absolute_import

import os
import sys

from hkube_python_wrapper import Algorunner
import optuna

_hkubeApi = None
globalReference = []


def getStudy(sampler, storagePath):
    if (sampler):
        if (sampler['name'] == 'Grid'):
            search_space = sampler['search_space']
            study = optuna.create_study(
                storage='sqlite:///' + storagePath, sampler=optuna.samplers.GridSampler(search_space))
        if (sampler['name'] == 'PartialFixed'):
            fixed_values = sampler['fixed_values']
            study = optuna.create_study(
                storage='sqlite:///' + storagePath, sampler=optuna.samplers.PartialFixedSampler(fixed_values))
        if (sampler['name'] == 'Random'):
            study = optuna.create_study(
                storage='sqlite:///' + storagePath, sampler=optuna.samplers.RandomSampler())
        if (sampler['name'] == 'TPE'):
            study = optuna.create_study(
                storage='sqlite:///' + storagePath, sampler=optuna.samplers.TPESampler())
        if (sampler['name'] == 'CmaEs'):
            study = optuna.create_study(
                storage='sqlite:///' + storagePath, sampler=optuna.samplers.CmaEsSampler())
    else:
        study = optuna.create_study(storage='sqlite:///'+storagePath)
    return study


def start(options, hkubeApi):
    hyperParams = options['spec']['hyperParams']
    pipelineName = options['spec']['objectivePipeline']
    numberOfTrails = options['spec']['numberOfTrials']
    sampler = options['spec'].get('sampler')
    sharedStorage = os.environ.get('SHARED_METRICS', '/hkube/shared-metrics')
    sharedStorage = str(sharedStorage) + '/' + str(options['jobId'])
    study = getStudy(sampler, sharedStorage)

    globalReference.append(study)

    def objective(trial):
        return objectiveWrapped(trial, hkubeApi, hyperParams, pipelineName)

    study.optimize(objective, n_trials=numberOfTrails)
    study.best_params

    return study.best_params


def stop(options):
    try:
        globalReference[0].stop()
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
