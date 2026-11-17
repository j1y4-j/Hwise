import type { InputProcessorOrWorkflow, ProcessInputArgs, ProcessInputResult } from '@mastra/core/processors';
import { hwiseWorkspace } from './hwise-workspace';

const TOP_K = 5;
const MAX_HIT_CHARS = 1_400;
const SDLC_QUERY = 'healthcare software development lifecycle requirements design tests review CI release maintenance security validation';
const HEALTHCARE_QUERY = 'healthcare software electronic health records laboratory information systems hospital disease surveillance health information interoperability documented development testing release';

const partText = (part: unknown): string => {
  if (typeof part === 'string') return part;
  if (!part || typeof part !== 'object') return '';
  const value = part as Record<string, unknown>;
  if (typeof value.text === 'string') return value.text;
  if (typeof value.content === 'string') return value.content;
  return '';
};

const messageText = (message: { content?: unknown }): string => {
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(partText).join('\n');
  if (content && typeof content === 'object') {
    const value = content as Record<string, unknown>;
    if (typeof value.content === 'string') return value.content;
    if (Array.isArray(value.parts)) return value.parts.map(partText).join('\n');
  }
  return '';
};

const queryFromMessages = (messages: Array<{ role?: string; content?: unknown }>) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== 'user') continue;
    const text = messageText(message).trim();
    if (text && !text.startsWith('/')) return text;
  }
  return '';
};

export const retrieveHealthcareEvidence = async (query: string) => {
  const trimmed = query.trim();
  if (trimmed.length < 5) return [];
  return hwiseWorkspace.search(trimmed, { mode: 'bm25', topK: TOP_K });
};

const mergeUnique = (...lists: Array<Array<{ id: string; content: string }>>) => {
  const seen = new Set<string>();
  const merged: Array<{ id: string; content: string }> = [];
  for (const list of lists) {
    for (const hit of list) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      merged.push(hit);
    }
  }
  return merged.slice(0, 8);
};

export const formatHealthcareEvidence = (hits: Array<{ id: string; content: string }>) => {
  if (hits.length === 0) {
    return [
      'Retrieved healthcare evidence: none.',
      'Do not invent healthcare software project facts, SDLC names, legal applicability, or clinical/regulatory claims.',
      'Mark unsupported material claims NEEDS-VALIDATION and state that the indexed corpus supplied no supporting evidence.',
    ].join('\n');
  }

  const blocks = hits.map((hit, index) => {
    const excerpt = hit.content.replace(/\s+/g, ' ').trim().slice(0, MAX_HIT_CHARS);
    return `[${index + 1}] ${hit.id}\n${excerpt}`;
  });

  return [
    'Retrieved evidence from docs/ingested/healthcare. Cite exact project names and source URLs included below.',
    'The records report public documentation, not a verified audit of internal practice. Do not infer missing processes.',
    ...blocks,
  ].join('\n\n');
};

export const assertHealthcareCorpusSearchable = async () => {
  const hits = await retrieveHealthcareEvidence('healthcare software SDLC documented release testing');
  if (hits.length === 0) {
    throw new Error('Hwise workspace BM25 index returned no results. Check docs/ingested/healthcare and HWISE_WORKSPACE_ROOT.');
  }
};

export const healthcareRagContextProcessor = {
  id: 'hwise-healthcare-rag-context',
  name: 'Hwise Healthcare Evidence Retrieval',
  async processInput({ messages, systemMessages }: ProcessInputArgs): Promise<ProcessInputResult> {
    const query = queryFromMessages(messages);
    if (!query) return { messages, systemMessages };

    const evidence = formatHealthcareEvidence(mergeUnique(
      await retrieveHealthcareEvidence(query),
      await retrieveHealthcareEvidence(SDLC_QUERY),
      await retrieveHealthcareEvidence(HEALTHCARE_QUERY),
    ));
    const existingSystemContent = systemMessages.map(messageText).filter(Boolean).join('\n\n');

    // Keep system instructions and retrieved context together as one system message
    // for predictable local-model chat-template compatibility.
    return {
      messages,
      systemMessages: [{
        role: 'system',
        content: [existingSystemContent, evidence].filter(Boolean).join('\n\n'),
      }],
    };
  },
} as InputProcessorOrWorkflow;
