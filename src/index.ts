/**
 * @essentianlabs/openclaw-radar
 *
 * OpenClaw plugin that registers radar_assess, radar_strategy, and radar_reload
 * as tools for any OpenClaw agent. Wraps @essentianlabs/radar-lite.
 */

import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import * as radar from '@essentianlabs/radar-lite';
import { OPENCLAW_INSTRUCTION, extractCurrentBlock } from './instruction.js';
import { safeReadFile, safeWriteFile } from './safe-fs.js';

const require = createRequire(import.meta.url);

// ── Types ──────────────────────────────────────────────────────────────

interface PluginApi {
  registerTool(definition: ToolDefinition): void;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

const VALID_ACTIVITY_TYPES = [
  'email_single',
  'email_bulk',
  'publish',
  'data_read',
  'data_write',
  'data_delete_single',
  'data_delete_bulk',
  'web_search',
  'external_api_call',
  'system_execute',
  'system_files',
  'financial',
] as const;

const VALID_STRATEGIES = [
  'avoid',
  'mitigate',
  'transfer',
  'accept',
  'override_deny',
] as const;

// ── LLM configuration ─────────────────────────────────────────────────

function resolveProvider(): { provider: string; apiKey: string; t2Provider?: string; t2ApiKey?: string } | null {
  // Check for dual-provider T2 segregation first
  const t2Provider = process.env.T2_PROVIDER;
  const t2ApiKey = process.env.T2_API_KEY;

  // Primary provider: check in order of preference
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...(t2Provider && t2ApiKey ? { t2Provider, t2ApiKey } : {}),
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      ...(t2Provider && t2ApiKey ? { t2Provider, t2ApiKey } : {}),
    };
  }
  if (process.env.GOOGLE_API_KEY) {
    return {
      provider: 'google',
      apiKey: process.env.GOOGLE_API_KEY,
      ...(t2Provider && t2ApiKey ? { t2Provider, t2ApiKey } : {}),
    };
  }

  return null;
}

// ── Startup checks ────────────────────────────────────────────────────

function checkClaudeMdSync(): void {
  const claudeMdPath = join(homedir(), '.claude', 'CLAUDE.md');
  const content = safeReadFile(claudeMdPath);
  if (content === null) return;
  const currentBlock = extractCurrentBlock(content);
  if (currentBlock && currentBlock.trim() !== OPENCLAW_INSTRUCTION.trim()) {
    console.error(
      '[openclaw-radar] CLAUDE.md instruction is out of date with the installed package. ' +
      'Run `npx openclaw-radar install` to refresh it.'
    );
  }
}

const UPDATE_CHECK_CACHE = join(homedir(), '.radar', '.openclaw-update-check');
const UPDATE_CHECK_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function checkRadarLiteVersion(): Promise<void> {
  let installed: string;
  try {
    const radarPkgPath = require.resolve('@essentianlabs/radar-lite/package.json');
    installed = JSON.parse(readFileSync(radarPkgPath, 'utf-8')).version;
  } catch {
    return; // radar-lite not installed
  }

  let cache: { checkedAt: number; latest: string } | null = null;
  const cacheRaw = safeReadFile(UPDATE_CHECK_CACHE);
  if (cacheRaw !== null) {
    try {
      cache = JSON.parse(cacheRaw);
    } catch {
      cache = null;
    }
  }

  const now = Date.now();
  let latest = cache?.latest;

  if (!cache || (now - cache.checkedAt) > UPDATE_CHECK_TTL_MS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('https://registry.npmjs.org/@essentianlabs%2fradar-lite/latest', {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data: any = await res.json();
        latest = data.version;
        try {
          mkdirSync(join(homedir(), '.radar'), { recursive: true });
          safeWriteFile(UPDATE_CHECK_CACHE, JSON.stringify({ checkedAt: now, latest }));
        } catch {
          // Ignore write failure
        }
      }
    } catch {
      return; // Network failure — silent
    }
  }

  if (latest && compareVersions(latest, installed) > 0) {
    console.error(
      `[openclaw-radar] @essentianlabs/radar-lite v${latest} is available (installed: v${installed}). ` +
      `Run \`npm install @essentianlabs/radar-lite@latest\` to update.`
    );
  }
}

function checkLlmKey(): void {
  const hasKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  if (!hasKey) {
    console.error(
      '[openclaw-radar] No LLM API key found. RADAR will use the rules engine only — ' +
      'HOLD verdicts will lack strategy options and Vela reasoning. ' +
      'Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY to enable Vela Lite.'
    );
  }
}

// ── Plugin entry point ─────────────────────────────────────────────────

export default {
  async register(api: PluginApi) {
    // Startup checks — informational, never block registration
    checkLlmKey();
    checkClaudeMdSync();
    checkRadarLiteVersion().catch(() => {});

    // Configure radar-lite with available LLM provider
    const llm = resolveProvider();
    if (llm) {
      const config: Record<string, string> = {
        llmProvider: llm.provider,
        llmKey: llm.apiKey,
      };
      if (llm.t2Provider) config.t2Provider = llm.t2Provider;
      if (llm.t2ApiKey) config.t2Key = llm.t2ApiKey;

      await (radar as any).configure(config);
    }

    // ── radar_assess ─────────────────────────────────────────────

    api.registerTool({
      name: 'radar_assess',
      description:
        'Assess an intended action for risk before executing it. ' +
        'Returns PROCEED, HOLD, or DENY with Vela Lite reasoning and strategy options. ' +
        'Call this before any action that modifies data, sends communications, ' +
        'deletes records, executes system commands, or interacts with external APIs.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'What the agent intends to do',
          },
          activityType: {
            type: 'string',
            description:
              'Category of the intended action. Valid types: ' +
              VALID_ACTIVITY_TYPES.join(', '),
            enum: VALID_ACTIVITY_TYPES,
          },
          agentId: {
            type: 'string',
            description: 'Identifier for this agent (optional)',
          },
        },
        required: ['action', 'activityType'],
        additionalProperties: false,
      },
      async execute(params) {
        const action = params.action as string;
        const activityType = params.activityType as string;
        const agentId = params.agentId as string | undefined;

        // Input validation
        if (!action || typeof action !== 'string' || action.trim().length === 0) {
          return { error: 'action must be a non-empty string' };
        }
        if (action.length > 4000) {
          return { error: 'action exceeds maximum length of 4000 characters' };
        }
        if (!VALID_ACTIVITY_TYPES.includes(activityType as typeof VALID_ACTIVITY_TYPES[number])) {
          return { error: `Invalid activityType: ${activityType}. Must be one of: ${VALID_ACTIVITY_TYPES.join(', ')}` };
        }

        try {
          // Reload config before each assessment to pick up dashboard changes
          await (radar as any).reload();

          const result = await (radar as any).assess(action, activityType, {
            ...(agentId ? { agentId } : {}),
          });

          return result;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return { error: `radar_assess failed: ${message}` };
        }
      },
    });

    // ── radar_strategy ───────────────────────────────────────────

    api.registerTool({
      name: 'radar_strategy',
      description:
        'Record a risk strategy decision after a HOLD verdict. ' +
        'Call this after the user chooses how to handle a held action.',
      parameters: {
        type: 'object',
        properties: {
          callId: {
            type: 'string',
            description: 'The callId from the radar_assess result',
          },
          strategy: {
            type: 'string',
            description: 'The chosen strategy',
            enum: VALID_STRATEGIES,
          },
          reason: {
            type: 'string',
            description: 'Why this strategy was chosen (optional)',
          },
          decidedBy: {
            type: 'string',
            description: 'Who made the decision (optional)',
          },
        },
        required: ['callId', 'strategy'],
        additionalProperties: false,
      },
      async execute(params) {
        const callId = params.callId as string;
        const strategy = params.strategy as string;
        const reason = params.reason as string | undefined;
        const decidedBy = params.decidedBy as string | undefined;

        try {
          const result = await (radar as any).strategy(callId, strategy, {
            ...(reason ? { reason } : {}),
            ...(decidedBy ? { decidedBy } : {}),
          });

          return result;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return { error: `radar_strategy failed: ${message}` };
        }
      },
    });

    // ── radar_reload ─────────────────────────────────────────────

    api.registerTool({
      name: 'radar_reload',
      description:
        'Force re-read of RADAR configuration from disk. ' +
        'Use after changing settings in the RADAR dashboard.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      async execute() {
        try {
          await (radar as any).reload();
          return { ok: true, message: 'RADAR configuration reloaded from disk' };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return { error: `radar_reload failed: ${message}` };
        }
      },
    });
  },
};
