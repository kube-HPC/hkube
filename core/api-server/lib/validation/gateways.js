/* eslint-disable no-restricted-syntax */
const { nodeKind, stateType } = require('@hkube/consts');
const { InvalidDataError } = require('../errors');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateGateway(gateway) {
        this._validator.validate(this._validator.definitions.gateway, gateway, true);
    }

    validateGatewayNodes(nodes) {
        for (const node of nodes) {
            if (node.kind === nodeKind.Gateway) {
                const { nodeName, stateType: nodeStateType } = node;
                if (nodeStateType && nodeStateType !== stateType.Stateful) {
                    throw new InvalidDataError(`Gateway node ${nodeName} stateType must be "stateful". Got ${nodeStateType}`);
                }
            }
        }
    }
}

module.exports = ApiValidator;
