/**
 * @essentianlabs/openclaw-radar
 *
 * OpenClaw plugin that registers radar_assess, radar_strategy, and radar_reload
 * as tools for any OpenClaw agent. Wraps @essentianlabs/radar-lite.
 */

// radar-lite is ESM and exports these functions from src/index.js
import * as radar from '@essentianlabs/radar-lite';

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

// ── Plugin entry point ─────────────────────────────────────────────────

export default {
  async register(api: PluginApi) {
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

        // Reload config before each assessment to pick up dashboard changes
        await (radar as any).reload();

        const result = await (radar as any).assess(action, activityType, {
          ...(agentId ? { agentId } : {}),
        });

        return result;
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

        const result = await (radar as any).strategy(callId, strategy, {
          ...(reason ? { reason } : {}),
          ...(decidedBy ? { decidedBy } : {}),
        });

        return result;
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
        await (radar as any).reload();
        return { ok: true, message: 'RADAR configuration reloaded from disk' };
      },
    });
  },
};
