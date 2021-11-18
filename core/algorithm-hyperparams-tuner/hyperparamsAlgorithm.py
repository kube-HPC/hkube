from __future__ import print_function, division, absolute_import

import os
import sys
import optuna
from optunaConsts import consts

_hkubeApi = None
globalReference = []


def getStudy(sampler, storagePath):
    if (sampler):
        if (sampler[consts.name] == consts.Grid):
            search_space = sampler[consts.searchSpace]
            study = optuna.create_study(
                storage='sqlite:///' + storagePath, sampler=optuna.samplers.GridSampler(search_space))
        if (sampler[consts.name] == consts.partialFixed):
            fixed_values = sampler[consts.fixed_values]
            study = optuna.create_study(
                storage='sqlite:///' + storagePath, sampler=optuna.samplers.PartialFixedSampler(fixed_values))
        if (sampler[consts.name] == consts.random):
            study = optuna.create_study(
                storage='sqlite:///' + storagePath, sampler=optuna.samplers.RandomSampler())
        if (sampler[consts.name] == consts.tpe):
            study = optuna.create_study(
                storage='sqlite:///' + storagePath, sampler=optuna.samplers.TPESampler())
        if (sampler[consts.name] == consts.CmaEs):
            study = optuna.create_study(
                storage='sqlite:///' + storagePath, sampler=optuna.samplers.CmaEsSampler())
    else:
        study = optuna.create_study(storage='sqlite:///'+storagePath)
    return study


def start(options, hkubeApi):
    hyperParams = options[consts.spec][consts.hyperParams]
    pipelineName = options[consts.spec][consts.objectivePipeline]
    numberOfTrails = options[consts.spec][consts.numberOfTrials]
    sampler = options[consts.spec].get(consts.sampler)
    sharedStorage = os.environ.get('SHARED_METRICS', '/hkube/shared-metrics')
    sharedStorage = str(sharedStorage) + '/' + str(options['jobId'])
    study = getStudy(sampler, sharedStorage)

    globalReference.append(study)

    def objective(trial):
        return objectiveWrapped(trial, hkubeApi, hyperParams, pipelineName)

    study.optimize(objective, n_trials=numberOfTrails)
    return study.best_params


def stop(options):
    try:
        globalReference[0].stop()
    except:
        pass


def objectiveWrapped(trial, hkubeApi, hyperParams, pipelineName):
    values = {}
    for param in hyperParams:
        values[param[consts.name]] = getattr(
            sys.modules[__name__], "suggest_%s" % param[consts.suggest])(param, trial)
    pipelineResult = hkubeApi.start_stored_subpipeline(
        pipelineName, {consts.hyperParams: values}, True)
    if (len(pipelineResult) == 0):
        raise Exception('objective pipeline has no result')
    if (isinstance(pipelineResult, str)):
        raise Exception(pipelineResult)
    result = pipelineResult[0]['result']
    if (isinstance(result, list)):
        result = result[0]
    return result


def suggest_uniform(param, trial):
    return trial.suggest_uniform(param[consts.name], param[consts.low], param[consts.high])


def suggest_int(param, trial):
    return trial.suggest_int(param[consts.name], param[consts.low], param[consts.high])


def suggest_loguniform(param, trial):
    return trial.suggest_loguniform([consts.name], param[consts.low], param[consts.high])


def suggest_discrete_uniform(param, trial):
    return trial.suggest_discrete_uniform(param[consts.name], param[consts.low], param[consts.high])


def suggest_categorical(param, trial):
    return trial.suggest_uniform(param[consts.name], param[consts.choices])
