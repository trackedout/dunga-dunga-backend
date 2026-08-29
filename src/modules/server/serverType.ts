/**
 * Central source of truth for classifying network server names.
 *
 * Server names encode their type and role by prefix + numeric range:
 *   - d700-d799  Fargate (ECS) dungeons     — launched on demand, terminated when empty
 *   - d800-d899  k3s dungeons               — long-lived, rebuildable in-cluster
 *   - s400-s409  league sandbox slots       — ECS-backed, managed by LeagueSandbox + job-scheduler
 *   - builders / builders2  build servers   — persistent, excluded from dungeon lifecycle
 *
 * Prefer the intent-revealing predicates in this module (isDungeon, isSandbox,
 * isEcsBacked, ...) over ad-hoc `name.startsWith(...)` checks so the taxonomy
 * lives in exactly one place.
 */

export enum ServerType {
  FARGATE_DUNGEON = 'fargate-dungeon', // d700-d799
  K3S_DUNGEON = 'k3s-dungeon', // d800-d899
  SANDBOX = 'sandbox', // s400-s409
  BUILDERS = 'builders', // builders, builders2
  UNKNOWN = 'unknown',
}

const FARGATE_DUNGEON_RE = /^d7\d{2}$/;
const K3S_DUNGEON_RE = /^d8\d{2}$/;
const SANDBOX_RE = /^s4\d{2}$/;
const BUILDERS_RE = /^builders2?$/;

/** Numeric-range descriptors for name allocation (single source of truth). */
export const FARGATE_DUNGEON_RANGE = { prefix: 'd', start: 700, count: 100 } as const;
export const K3S_DUNGEON_RANGE = { prefix: 'd', start: 800, count: 100 } as const;
export const SANDBOX_RANGE = { prefix: 's', start: 400, count: 10 } as const;

export function classifyServer(name: string | undefined | null): ServerType {
  if (!name) {
    return ServerType.UNKNOWN;
  }
  if (FARGATE_DUNGEON_RE.test(name)) {
    return ServerType.FARGATE_DUNGEON;
  }
  if (K3S_DUNGEON_RE.test(name)) {
    return ServerType.K3S_DUNGEON;
  }
  if (SANDBOX_RE.test(name)) {
    return ServerType.SANDBOX;
  }
  if (BUILDERS_RE.test(name)) {
    return ServerType.BUILDERS;
  }
  return ServerType.UNKNOWN;
}

export const isFargateDungeon = (name: string | undefined | null): boolean =>
  classifyServer(name) === ServerType.FARGATE_DUNGEON;

export const isK3sDungeon = (name: string | undefined | null): boolean => classifyServer(name) === ServerType.K3S_DUNGEON;

export const isSandbox = (name: string | undefined | null): boolean => classifyServer(name) === ServerType.SANDBOX;

export const isBuilders = (name: string | undefined | null): boolean => classifyServer(name) === ServerType.BUILDERS;

/** Any dungeon, regardless of where it runs. */
export const isDungeon = (name: string | undefined | null): boolean => {
  const type = classifyServer(name);
  return type === ServerType.FARGATE_DUNGEON || type === ServerType.K3S_DUNGEON;
};

/**
 * Servers that run as ECS/Fargate tasks and are therefore reached via a
 * Kubernetes Endpoint ({name}-ecs) that the job-scheduler patches with the
 * real task IP. Their inbound request IP is the pod-network gateway, so the
 * backend must rewrite sourceIP to the endpoint name for these.
 */
export const isEcsBacked = (name: string | undefined | null): boolean => {
  const type = classifyServer(name);
  return type === ServerType.FARGATE_DUNGEON || type === ServerType.SANDBOX;
};

/** The Kubernetes Endpoint name used to route to an ECS-backed server. */
export const ecsEndpointName = (name: string): string => `${name}-ecs`;

/** MongoDB regex for matching Fargate dungeon names (d700-d799). */
export const FARGATE_DUNGEON_NAME_REGEX = FARGATE_DUNGEON_RE;

/** MongoDB regex for matching k3s dungeon names (d800-d899). */
export const K3S_DUNGEON_NAME_REGEX = K3S_DUNGEON_RE;
