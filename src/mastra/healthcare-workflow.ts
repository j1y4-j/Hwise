import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { healthcareRequirementsAgent, healthcareSdlcRecommendationAgent } from './healthcare-agents';
import { hwiseWorkspaceRoot } from './hwise-workspace';

const previewDir = join(hwiseWorkspaceRoot, 'artifacts/hwise-healthcare-sdlc');

const cleanModelText = (text: string) => {
  let output = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');
  const unclosed = output.match(/<think\b[^>]*>([\s\S]*)$/i);
  if (unclosed) output = unclosed[1] ?? '';
  return output.replace(/<\/?think\b[^>]*>/gi, '').replace(/\n{3,}/g, '\n\n').trim();
};

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const markdownPreview = (markdown: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hwise Healthcare SDLC</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:1000px;margin:40px auto;padding:0 20px;color:#172033}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f7fa;padding:24px;border-radius:8px}</style></head>
<body><h1>Hwise Healthcare SDLC — Markdown preview</h1><pre>${escapeHtml(markdown)}</pre></body></html>`;

const profileHealthcareRequirements = createStep({
  id: 'profile-healthcare-requirements',
  description: 'Create a requirements profile for healthcare software with evidence and validation gaps.',
  inputSchema: z.object({ prompt: z.string().min(1) }),
  outputSchema: z.object({ requirements: z.string() }),
  execute: async ({ inputData }) => {
    const result = await healthcareRequirementsAgent.generate(inputData.prompt);
    const requirements = cleanModelText(result.text ?? '');
    if (!requirements) throw new Error('Hwise Healthcare Requirements Agent returned no text');
    return { requirements };
  },
});

const recommendHealthcareSdlc = createStep({
  id: 'recommend-healthcare-sdlc',
  description: 'Compare healthcare lifecycle options using project factors and cited public evidence.',
  inputSchema: z.object({ requirements: z.string() }),
  outputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string() }),
  execute: async ({ inputData }) => {
    const result = await healthcareSdlcRecommendationAgent.generate(
      `Recommend and justify a lifecycle for this healthcare software requirements profile. Keep observed dataset practices separate from recommendations.\n\n${inputData.requirements}`,
    );
    const sdlc = cleanModelText(result.text ?? '');
    if (!sdlc) throw new Error('Hwise Healthcare SDLC Recommendation Agent returned no text');
    return { requirements: inputData.requirements, sdlc, document: `${inputData.requirements.trim()}\n\n---\n\n${sdlc}` };
  },
});

const writeHealthcarePreviews = createStep({
  id: 'write-hwise-healthcare-previews',
  description: 'Write Markdown and escaped HTML previews of the Hwise healthcare SDLC output.',
  inputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string() }),
  outputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string(), markdownPath: z.string(), htmlPath: z.string() }),
  execute: async ({ inputData }) => {
    await mkdir(previewDir, { recursive: true });
    const markdownPath = join(previewDir, 'latest.md');
    const htmlPath = join(previewDir, 'latest.html');
    await writeFile(markdownPath, `${inputData.document.trim()}\n`, 'utf8');
    await writeFile(htmlPath, markdownPreview(inputData.document), 'utf8');
    return { ...inputData, markdownPath, htmlPath };
  },
});

export const healthcareRequirementsThenSdlc = createWorkflow({
  id: 'healthcare-requirements-then-sdlc',
  description: 'Hwise healthcare flow: profile requirements, recommend a conditional SDLC, and write evidence-aware previews.',
  inputSchema: z.object({ prompt: z.string().min(1) }),
  outputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string(), markdownPath: z.string(), htmlPath: z.string() }),
})
  .then(profileHealthcareRequirements)
  .then(recommendHealthcareSdlc)
  .then(writeHealthcarePreviews)
  .commit();

export const runHealthcareRequirementsThenSdlc = async (prompt: string) => {
  const run = await healthcareRequirementsThenSdlc.createRun();
  const result = await run.start({ inputData: { prompt } });
  if (result.status !== 'success') {
    const message = result.status === 'failed' ? result.error.message : result.status;
    throw new Error(`Hwise healthcare workflow failed: ${message}`);
  }
  return result.result;
};
