import { Agent } from '@mastra/core/agent';
import { healthcareRagContextProcessor } from './healthcare-rag';
import { hwiseChatModel } from './hwise-model';
import { HEALTHCARE_REQUIREMENTS_PROMPT, HEALTHCARE_SDLC_PROMPT } from './healthcare-prompts';


const sharedOptions = {
  modelSettings: { maxOutputTokens: 1_800 },
} as const;


export const healthcareRequirementsAgent = new Agent({
  id: 'hwise-healthcare-requirements-agent',
  name: 'Hwise Healthcare Requirements Agent',
  description: 'Builds a requirements profile for healthcare software and separates source-backed evidence from assumptions.',
  instructions: HEALTHCARE_REQUIREMENTS_PROMPT,
  model: hwiseChatModel,
  defaultOptions: sharedOptions,
  inputProcessors: [healthcareRagContextProcessor],
});

export const healthcareSdlcRecommendationAgent = new Agent({
  id: 'hwise-healthcare-sdlc-agent',
  name: 'Hwise Healthcare SDLC Recommendation Agent',
  description: 'Compares lifecycle options using project-specific factors and cited public healthcare software evidence.',
  instructions: HEALTHCARE_SDLC_PROMPT,
  model: hwiseChatModel,
  defaultOptions: {
    ...sharedOptions,
    modelSettings: { maxOutputTokens: 2_200 },
  },
  inputProcessors: [healthcareRagContextProcessor],
});
