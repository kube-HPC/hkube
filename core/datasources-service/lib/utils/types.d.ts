export type NormalizedFileMeta = { [fileId: string]: FileMeta };
export type MulterFile = Express.Multer.File;
export type SourceTargetArray = [FileMeta, FileMeta];
export type config = typeof import('./../../config/main/config.base');
export type gitConfig = Omit<
    typeof import('./../../config/main/config.base').git,
    'user'
>;

import { FileMeta } from '@hkube/db/lib/DataSource';
import {
    DvcFileMeta,
    LocalFileMeta,
    DvcContent,
} from '@hkube/datasource-utils';
export type { FileMeta, DvcFileMeta, LocalFileMeta, DvcContent };
