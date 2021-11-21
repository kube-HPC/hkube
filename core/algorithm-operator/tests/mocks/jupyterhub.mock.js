module.exports = {
    jupyterApi: () => {
        let callCount = {};
        let listData = [];
        const registerCount = (name, args) => {
            if (!callCount[name]) {
                callCount[name] = [];
            }
            callCount[name].push(args);
        }
        return {
            mock: {
                init: async () => { },
                updateToken: async () => { },
                create: async (...theArgs) => {
                    registerCount('create', theArgs)
                },
                remove: async (...theArgs) => {
                    registerCount('remove', theArgs)
                },
                delete: async (...theArgs) => {
                    registerCount('delete', theArgs)
                },
                list: async (...theArgs) => {
                    registerCount('list', theArgs)
                    return listData;
                },
            },
            setList: (list) => {
                listData = list;
            },
            callCount: (name) => { return callCount[name] || []; },
            clearCount: () => { callCount = {} },
        }
    }
};

