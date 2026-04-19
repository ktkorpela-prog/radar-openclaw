declare module '@essentianlabs/radar-lite' {
  export function configure(config: Record<string, string>): Promise<void>;
  export function assess(
    action: string,
    activityType: string,
    options?: { agentId?: string },
  ): Promise<Record<string, unknown>>;
  export function strategy(
    callId: string,
    chosenStrategy: string,
    options?: { reason?: string; decidedBy?: string },
  ): Promise<Record<string, unknown>>;
  export function reload(): Promise<void>;
  export function history(): Promise<unknown[]>;
  export function stats(): Promise<Record<string, unknown>>;
  export function checkPolicy(activityType: string): Promise<Record<string, unknown>>;
  export function saveActivityConfig(config: Record<string, unknown>): Promise<void>;
  export function savePolicy(policy: Record<string, unknown>): Promise<void>;
}
