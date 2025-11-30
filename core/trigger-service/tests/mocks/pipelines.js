const { uid: uid } = require('@hkube/uid');

const pipelineTriggeredThree = `pipeline_triggered_three_${uid(6)}`

const pipelines = [
    {
        "name": `simple_${uid(6)}`
    },
    {
        "name": `batch_${uid(6)}`
    },
    {
        "name": `simple_cron_trigger_${uid(6)}`,
        "triggers": {
            "cron": {
                "pattern": "*/1 * * * * *",
                "enabled": true
            }
        }
    },
    {
        "name": `invalid_cron_trigger_${uid(6)}`,
        "triggers": {
            "cron": {
                "pattern": "Im invalid cron",
                "enabled": true
            }
        }
    },
    {
        "name": `simple_pipelines_trigger_${uid(6)}`,
        "triggers": {
            "pipelines": [
                "xxx"
            ]
        }
    },
    {
        "name": `trigger-4_${uid(6)}`,
        "triggers": {
            "pipelines": [
                "test-not-called"
            ]
        }
    },
    {
        "name": `trigger-1_${uid(6)}`,
        "triggers": {
            "pipelines": [
                pipelineTriggeredThree
            ]
        }
    },
    {
        "name": `trigger-2_${uid(6)}`,
        "triggers": {
            "pipelines": [
                pipelineTriggeredThree
            ]
        }
    },
    {
        "name": `trigger-3_${uid(6)}`,
        "triggers": {
            "pipelines": [
                pipelineTriggeredThree,
                "test_pl"
            ]
        }
    },
    {
        "name": pipelineTriggeredThree
    }
]

module.exports = pipelines;
