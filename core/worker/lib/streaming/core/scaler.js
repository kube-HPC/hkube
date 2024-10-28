const Logger = require('@hkube/logger');
const Interval = require('./interval');
const { Components } = require('../../consts');
const component = Components.AUTO_SCALER;
let log;

const SCALE_STATUS = {
    IDLE: 'idle',
    UNABLE_SCALE: 'unable scale up',
    PENDING_QUEUE: 'pending queue scale up',
    PENDING_SCALE_UP: 'pending scale up',
    PENDING_SCALE_DOWN: 'pending scale down',
    SCALING_UP: 'scaling up',
    SCALING_DOWN: 'scaling down'
};

/**
 * This class is responsible for holding the data
 * of required replicas at any moment, and also
 * the logic of scale up/down feasibility
 */
class Scaler {
    constructor(config, minStatelessCount, methods) {
        log = Logger.GetLogFromContainer();
        this._maxScaleUpReplicasPerNode = config.scaleUp.maxScaleUpReplicasPerNode;
        this._maxScaleUpReplicasPerTick = config.scaleUp.maxScaleUpReplicasPerTick;
        this._minTimeWaitBeforeRetryScale = config.minTimeWaitBeforeRetryScale;
        this._minTimeBetweenScales = config.minTimeBetweenScales;
        this._scaleInterval = config.scaleInterval;
        this._getQueue = methods.getQueue;
        this._getUnScheduledAlgorithm = methods.getUnScheduledAlgorithm;
        this._getCurrentSize = methods.getCurrentSize;
        this._scaleUp = methods.scaleUp;
        this._scaleDown = methods.scaleDown;
        this._required = 0;
        this._desired = minStatelessCount || 0;
        this._lastScaleUpTime = null;
        this._lastScaleDownTime = null;
        this._scale = false;
        this._status = SCALE_STATUS.IDLE;
        this._startInterval();
        this._minStatelessCount = minStatelessCount;
    }

    stop() {
        this._interval?.stop();
    }

    _startInterval() {
        this._interval = new Interval({ delay: this._scaleInterval })
            .onFunc(() => this._checkScale())
            .onError((e) => log.throttle.error(e.message, { component }, e))
            .start();
    }

    async _checkScale() {
        if (!this._scale) {
            return;
        }

        // let pendingUp = false;
        this._status = SCALE_STATUS.IDLE;
        const unScheduledAlgorithm = await this._getUnScheduledAlgorithm();

        if (unScheduledAlgorithm) {
            this._status = `${SCALE_STATUS.UNABLE_SCALE} ${unScheduledAlgorithm.message}`;
            // pendingUp = true;
        }
        else {
            const queue = await this._getQueue();
            if (queue) {
                this._status = SCALE_STATUS.PENDING_QUEUE;
                // pendingUp = true;
            }
        }

        const currentSize = this._getCurrentSize();
        const shouldScaleUp = this._shouldScaleUp(currentSize);
        const shouldScaleDown = this._shouldScaleDown(currentSize);

        if (shouldScaleUp) {
            const required = this._required - this._desired;
            const replicas = Math.min(required, this._maxScaleUpReplicasPerTick);
            log.info(`CYCLE: worker shouldScaleUp required: ${required}, replicas: ${replicas}, desired: ${this._desired}, currentSize: ${currentSize}`);
            const scaleTo = replicas + currentSize;
            this._desired = this._required;
            this._lastScaleUpTime = Date.now();
            this._status = SCALE_STATUS.SCALING_UP;
            this._scaleUp({ replicas, currentSize, scaleTo });
        }
        if (shouldScaleDown) {
            const replicas = currentSize - this._required;
            const scaleTo = this._required;
            log.info(`CYCLE: worker shouldScaleDown scaleTo: ${scaleTo}, replicas: ${replicas}, desired: ${this._desired}, currentSize: ${currentSize}`);
            this._desired = this._required;
            this._lastScaleDownTime = Date.now();
            this._status = SCALE_STATUS.SCALING_DOWN;
            this._scaleDown({ replicas, currentSize, scaleTo });
        }
    }

    get required() {
        return this._required;
    }

    get desired() {
        return this._desired;
    }

    get status() {
        return this._status;
    }

    updateRequired(required) {
        if (required !== this._required) {
            this._scale = true;
            this._required = Math.min(required, this._maxScaleUpReplicasPerNode);
        }
    }

    _shouldScaleUp(currentSize) {
        let shouldScaleUp = false;
        if (currentSize < this._required && this._desired <= this._required
            && (!this._lastScaleDownTime || Date.now() - this._lastScaleDownTime > this._minTimeBetweenScales)) {
            if (this._desired <= currentSize) {
                shouldScaleUp = true;
                this._notFulfilledTimeUp = null;
            }
            else {
                if (!this._notFulfilledTimeUp) {
                    this._notFulfilledTimeUp = Date.now();
                }
                if (Date.now() - this._notFulfilledTimeUp > this._minTimeWaitBeforeRetryScale) {
                    shouldScaleUp = true;
                    this._notFulfilledTimeUp = null;
                }
                else {
                    this._status = SCALE_STATUS.PENDING_SCALE_UP;
                }
            }
        }
        return shouldScaleUp;
    }

    _shouldScaleDown(currentSize) {
        let shouldScaleDown = false;
        if (currentSize > this._required
            && (!this._lastScaleUpTime || Date.now() - this._lastScaleUpTime > this._minTimeBetweenScales)) {
            if (this._desired >= currentSize) {
                shouldScaleDown = true;
                this._notFulfilledTimeDown = null;
            }
            else {
                if (!this._notFulfilledTimeDown) {
                    this._notFulfilledTimeDown = Date.now();
                }
                if (Date.now() - this._notFulfilledTimeDown > this._minTimeWaitBeforeRetryScale) {
                    shouldScaleDown = true;
                    this._notFulfilledTimeDown = null;
                }
                else {
                    this._status = SCALE_STATUS.PENDING_SCALE_DOWN;
                }
            }
        }
        return shouldScaleDown;
    }
}

module.exports = Scaler;
