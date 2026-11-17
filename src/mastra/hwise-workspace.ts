import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';

const configuredRoot = process.env.HWISE_WORKSPACE_ROOT?.trim();

export const hwiseWorkspaceRoot = [
  configuredRoot,
  process.env.INIT_CWD,
  process.cwd(),
  resolve(process.cwd(), '../../..'),
].find((path): path is string => Boolean(path && existsSync(join(path, 'docs/ingested/healthcare'))))
  ?? process.cwd();

export const hwiseWorkspace = new Workspace({
  id: 'hwise-healthcare-evidence-workspace',
  filesystem: new LocalFilesystem({ basePath: hwiseWorkspaceRoot, readOnly: true }),
  bm25: true,
  autoIndexPaths: ['docs/ingested/healthcare/**/*.md'],
  // Retrieval only: avoid exposing writable filesystem or shell tools to agents.
  tools: { enabled: false },
});
