import configContent from './../../config/main/config.base';

export type NormalizedFileMeta = { [fileId: string]: FileMeta };
export type MulterFile = Express.Multer.File;
export type SourceTargetArray = [FileMeta, FileMeta];

export type config = typeof configContent;
export type gitConfig = typeof configContent.git;

export type githubConfig = Omit<typeof configContent.git.github, 'user'>;
export type gitlabConfig = typeof configContent.git.gitlab;

import { FileMeta } from '@hkube/db/lib/DataSource';
import {
    DvcFileMeta,
    LocalFileMeta,
    DvcContent,
} from '@hkube/datasource-utils';
export type { FileMeta, DvcFileMeta, LocalFileMeta, DvcContent };
