export type NormalizedFileMeta = { [fileId: string]: FileMeta };
export type MulterFile = Express.Multer.File;
export type FileMeta = import('@hkube/db/lib/DataSource').FileMeta;
export type SourceTargetArray = [FileMeta, FileMeta];
export type config = typeof import('./../../config/main/config.base');
