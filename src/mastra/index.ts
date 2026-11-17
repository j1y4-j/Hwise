import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { healthcareRequirementsAgent, healthcareSdlcRecommendationAgent } from './healthcare-agents';
import { assertHealthcareCorpusSearchable } from './healthcare-rag';
import { healthcareRequirementsThenSdlc } from './healthcare-workflow';
import { hwiseCoordinator } from './hwise-coordinator';
import { hwiseWorkspace } from './hwise-workspace';

export const mastra = new Mastra({
  agents: {
    hwiseCoordinator,
    healthcareRequirementsAgent,
    healthcareSdlcRecommendationAgent,
  },
  workflows: { healthcareRequirementsThenSdlc },
  storage: new LibSQLStore({
    id: 'hwise-storage',
    url: process.env.HWISE_MASTRA_DATABASE_URL ?? 'file:./hwise.db',
  }),
});

await hwiseWorkspace.init();
await assertHealthcareCorpusSearchable();
