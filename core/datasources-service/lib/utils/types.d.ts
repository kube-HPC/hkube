export type NormalizedFileMeta = { [fileId: string]: FileMeta };
export type MulterFile = Express.Multer.File;
export type SourceTargetArray = [FileMeta, FileMeta];
export type config = typeof import('./../../config/main/config.base');

export type FileMeta = {
    id: string;
    name: string;
    size: number;
    type: string;
    meta?: string;
    uploadedAt: number;
    path: string;
};

export type LocalFileMeta = Omit<FileMeta, 'path'>;

export type DvcFileMeta = LocalFileMeta & { hash: string };

export type DvcContent = {
    outs: { md5: string; size: number; path: string }[];
    meta?: {
        hkube?: DvcFileMeta;
    };
};
