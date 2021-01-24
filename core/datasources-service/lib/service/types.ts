export type PipelineDatasourceDescriptor =
    | { name: string }
    | { id: string }
    | { name: string; snapshot: { name: string } };

export type Job = {
    jobId: string;
    taskId: string;
    dataSource: PipelineDatasourceDescriptor;
    nodeName: string;
};

export type DoneJob = {
    jobId: string;
    timestamp: string;
    pipeline: 'dataSource';
    data?: {
        storageInfo: {
            path: string;
        };
    };
    status: string;
    timeTook: number;
};

export type onJobHandler = (job: { data: Job }) => Promise<void>;
