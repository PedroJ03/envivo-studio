import { createMachine, initialTransition, transition, type SnapshotFrom } from "xstate";

export const contentMachineStates = [
  "draft",
  "approved",
  "generating",
  "generated",
  "reviewed",
  "published",
  "rejected",
  "failed",
] as const;

export type ContentMachineState = (typeof contentMachineStates)[number];

export const machineSnapshotVersion = 1;

export interface ContentMachineContext {
  tenantId: string;
  candidateContentId: string;
}

export type ContentMachineEvent =
  | { type: "SUBMIT_FOR_REVIEW"; actor?: string }
  | { type: "START_GENERATION"; actor?: string }
  | { type: "GENERATION_SUCCESS"; actor?: string }
  | { type: "GENERATION_FAILED"; actor?: string; reason?: string }
  | { type: "APPROVE"; actor?: string; rejectionReason?: string }
  | { type: "REJECT"; actor?: string; reason?: string }
  | { type: "REGENERATE"; actor?: string; reason?: string }
  | { type: "PUBLISH"; actor?: string }
  | { type: "REVIEW_TIMEOUT"; actor?: string; reason?: string };

type MachineEvent = ContentMachineEvent["type"];

export interface PersistedContentMachineSnapshot {
  version: number;
  state: ContentMachineState;
  context: ContentMachineContext;
}

export interface ContentTransitionResult {
  to: ContentMachineState;
  context: ContentMachineContext;
}

const machineId = "content-pipeline-v1";

const contentMachineTransitions: {
  [state in ContentMachineState]: Partial<Record<MachineEvent, ContentMachineState>>;
} = {
  draft: {
    SUBMIT_FOR_REVIEW: "approved",
  },
  approved: {
    START_GENERATION: "generating",
  },
  generating: {
    GENERATION_SUCCESS: "generated",
    GENERATION_FAILED: "failed",
    REVIEW_TIMEOUT: "failed",
  },
  generated: {
    APPROVE: "reviewed",
    REJECT: "rejected",
    REGENERATE: "approved",
    REVIEW_TIMEOUT: "failed",
  },
  reviewed: {
    PUBLISH: "published",
    APPROVE: "reviewed",
    REGENERATE: "approved",
  },
  published: {
    PUBLISH: "published",
  },
  rejected: {
    REGENERATE: "approved",
    REJECT: "rejected",
  },
  failed: {
    REGENERATE: "approved",
    REVIEW_TIMEOUT: "failed",
    GENERATION_FAILED: "failed",
  },
};

export function resolveMachineTransition(
  state: ContentMachineState,
  eventType: MachineEvent,
): ContentMachineState | undefined {
  return contentMachineTransitions[state]?.[eventType];
}

const contentMachine = createMachine({
  id: machineId,
  context: {
    tenantId: "",
    candidateContentId: "",
  },
  initial: "draft",
  types: {
    context: {} as ContentMachineContext,
    events: {} as ContentMachineEvent,
  },
  states: {
    draft: {
      on: {
        SUBMIT_FOR_REVIEW: {
          target: "approved",
        },
      },
    },
    approved: {
      on: {
        START_GENERATION: {
          target: "generating",
        },
      },
    },
    generating: {
      on: {
        GENERATION_SUCCESS: {
          target: "generated",
        },
        GENERATION_FAILED: {
          target: "failed",
        },
        REVIEW_TIMEOUT: {
          target: "failed",
        },
      },
    },
    generated: {
      on: {
        APPROVE: {
          target: "reviewed",
        },
        REJECT: {
          target: "rejected",
        },
        REGENERATE: {
          target: "approved",
        },
        REVIEW_TIMEOUT: {
          target: "failed",
        },
      },
    },
    reviewed: {
      on: {
        PUBLISH: {
          target: "published",
        },
        APPROVE: {
          target: "reviewed",
        },
        REGENERATE: {
          target: "approved",
        },
      },
    },
    published: {
      on: {
        PUBLISH: {
          target: "published",
        },
      },
    },
    rejected: {
      on: {
        REGENERATE: {
          target: "approved",
        },
        REJECT: {
          target: "rejected",
        },
      },
    },
    failed: {
      on: {
        REGENERATE: {
          target: "approved",
        },
        REVIEW_TIMEOUT: {
          target: "failed",
        },
        GENERATION_FAILED: {
          target: "failed",
        },
      },
    },
  },
});

const [machineInitialSnapshot] = initialTransition(contentMachine);

class InvalidTransitionError extends Error {
  public readonly code = "INVALID_TRANSITION";
  constructor(
    public readonly from: ContentMachineState,
    public readonly eventType: MachineEvent,
  ) {
    super(`Invalid content-machine transition ${from} -> ${eventType}`);
  }
}

export class SnapshotParseError extends Error {
  public readonly code = "INVALID_MACHINE_SNAPSHOT";
  constructor(message: string) {
    super(message);
  }
}

function isContentMachineState(value: unknown): value is ContentMachineState {
  return typeof value === "string" && contentMachineStates.includes(value as ContentMachineState);
}

function normalizeSnapshot(snapshot: PersistedContentMachineSnapshot): {
  state: ContentMachineState;
  context: ContentMachineContext;
} {
  const context = snapshot.context;

  if (!context || typeof context !== "object") {
    throw new SnapshotParseError("Snapshot context is missing or malformed.");
  }

  if (!isContentMachineState(snapshot.state)) {
    throw new SnapshotParseError(`Unsupported snapshot state '${String(snapshot.state)}'.`);
  }

  const tenantId = String(context.tenantId ?? "");
  const candidateContentId = String(context.candidateContentId ?? "");

  if (!tenantId || !candidateContentId) {
    throw new SnapshotParseError("Snapshot context missing tenantId or candidateContentId.");
  }

  return {
    state: snapshot.state,
    context: {
      tenantId,
      candidateContentId,
    },
  };
}

export function getInitialMachineSnapshot(
  tenantId: string,
  candidateContentId: string,
): PersistedContentMachineSnapshot {
  return {
    version: machineSnapshotVersion,
    state: "draft",
    context: {
      tenantId,
      candidateContentId,
    },
  };
}

export function deserializeMachineSnapshot(serialized: unknown): PersistedContentMachineSnapshot {
  if (!serialized || typeof serialized !== "object") {
    throw new SnapshotParseError("Serialized snapshot must be an object.");
  }

  const raw = serialized as Partial<PersistedContentMachineSnapshot>;

  if (raw.version !== machineSnapshotVersion) {
    throw new SnapshotParseError(
      `Snapshot version mismatch. Expected ${machineSnapshotVersion}, got ${String(raw.version)}.`,
    );
  }

  const normalized = normalizeSnapshot(raw as PersistedContentMachineSnapshot);

  return {
    version: machineSnapshotVersion,
    state: normalized.state,
    context: normalized.context,
  };
}

export function serializeMachineSnapshot(args: {
  state: ContentMachineState;
  context: ContentMachineContext;
}): PersistedContentMachineSnapshot {
  return {
    version: machineSnapshotVersion,
    state: args.state,
    context: {
      tenantId: args.context.tenantId,
      candidateContentId: args.context.candidateContentId,
    },
  };
}

function toRuntimeSnapshot(
  persisted: PersistedContentMachineSnapshot,
): SnapshotFrom<typeof contentMachine> {
  const { state, context } = normalizeSnapshot(persisted);

  return {
    ...machineInitialSnapshot,
    value: state,
    context,
  };
}

export function applyMachineTransition(
  persisted: PersistedContentMachineSnapshot,
  event: ContentMachineEvent,
): ContentTransitionResult {
  const currentSnapshot = toRuntimeSnapshot(persisted);
  const currentState =
    typeof currentSnapshot.value === "string" && isContentMachineState(currentSnapshot.value)
      ? currentSnapshot.value
      : "draft";

  const declaredNextState = resolveMachineTransition(currentState, event.type);
  if (!declaredNextState) {
    throw new InvalidTransitionError(currentState, event.type);
  }

  const [nextSnapshot] = transition(contentMachine, currentSnapshot, event);

  const nextState =
    typeof nextSnapshot.value === "string" && isContentMachineState(nextSnapshot.value)
      ? nextSnapshot.value
      : currentState;

  if (nextState !== declaredNextState) {
    throw new InvalidTransitionError(currentState, event.type);
  }

  return {
    to: nextState,
    context: {
      tenantId: currentSnapshot.context.tenantId,
      candidateContentId: currentSnapshot.context.candidateContentId,
    },
  };
}

export { contentMachine, InvalidTransitionError };
