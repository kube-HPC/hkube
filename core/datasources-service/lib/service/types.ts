export type PipelineDatasourceDescriptor =
    | { name: string; version: string; query: string }
    | { snapshotId: string };

export type Job = {
    jobId: string;
    taskId: string;
    dataSource: PipelineDatasourceDescriptor;
    nodeName: string;
};

export type onJobHandler = (job: { data: Job }) => Promise<void>;
