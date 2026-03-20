import { and, desc, eq, inArray } from "drizzle-orm";

import { withTenantDb } from "@/lib/db/client";
import { candidateContent, contentStates } from "@/lib/db/schema";
import {
  applyMachineTransition,
  deserializeMachineSnapshot,
  getInitialMachineSnapshot,
  InvalidTransitionError,
  serializeMachineSnapshot,
  type ContentMachineContext,
  type ContentMachineEvent,
  type ContentMachineState,
  type PersistedContentMachineSnapshot,
} from "./machine";

type PipelineTransaction = Parameters<Parameters<typeof withTenantDb>[1]>[0];

type CandidateStatus = "candidate" | "selected" | "rejected" | "archived";

type ContentStateRow = typeof contentStates.$inferSelect;

type CandidateContentRow = typeof candidateContent.$inferSelect;

class PipelineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

class ContentNotFoundError extends PipelineError {
  constructor(contentId: string) {
    super(`Content piece ${contentId} was not found for the current tenant.`, "CONTENT_NOT_FOUND");
  }
}

export interface ContentStateSnapshot {
  state: ContentMachineState;
  context: ContentMachineContext;
  serialized: PersistedContentMachineSnapshot;
  actor: string | null;
  rejectionReason: string | null;
}

export interface CandidateContentWithState extends CandidateContentRow {
  state: ContentStateSnapshot;
}

export interface ContentTransitionPayload {
  tenantId: string;
  candidateContentId: string;
  event: ContentMachineEvent;
  actor?: string;
  reason?: string;
  igPostId?: string;
}

export interface AppliedContentTransition {
  from: ContentMachineState;
  to: ContentMachineState;
  state: ContentStateSnapshot;
  igPostId?: string;
}

function extractReason(event: ContentMachineEvent): string | undefined {
  switch (event.type) {
    case "REJECT":
    case "REGENERATE":
    case "REVIEW_TIMEOUT":
    case "GENERATION_FAILED":
      return event.reason;
    case "APPROVE":
      return event.rejectionReason;
    default:
      return undefined;
  }
}

function resolveCandidateStatus(
  toState: ContentMachineState,
  event: ContentMachineEvent,
): CandidateStatus {
  if (event.type === "REJECT") {
    return "rejected";
  }

  if (
    toState === "approved" ||
    toState === "generating" ||
    toState === "generated" ||
    toState === "reviewed" ||
    toState === "published"
  ) {
    return "selected";
  }

  if (event.type === "REVIEW_TIMEOUT" || toState === "rejected" || toState === "failed") {
    return "rejected";
  }

  return "candidate";
}

function parsePersistedState(
  raw: unknown,
  tenantId: string,
  candidateContentId: string,
): PersistedContentMachineSnapshot {
  if (!raw) {
    return getInitialMachineSnapshot(tenantId, candidateContentId);
  }

  try {
    return deserializeMachineSnapshot(raw);
  } catch {
    return getInitialMachineSnapshot(tenantId, candidateContentId);
  }
}

function mapLatestStateRows(rows: ContentStateRow[]): Map<string, ContentStateRow> {
  const grouped = new Map<string, ContentStateRow>();

  for (const row of rows) {
    if (!grouped.has(row.candidateContentId)) {
      grouped.set(row.candidateContentId, row);
    }
  }

  return grouped;
}

export async function getContentCandidate(
  tx: PipelineTransaction,
  candidateContentId: string,
  tenantId: string,
): Promise<CandidateContentRow | null> {
  const rows = await tx
    .select()
    .from(candidateContent)
    .where(and(eq(candidateContent.id, candidateContentId), eq(candidateContent.tenantId, tenantId)));

  const typedRows = rows as CandidateContentRow[];

  return typedRows[0] ?? null;
}

export async function getLatestSnapshotForCandidate(
  tx: PipelineTransaction,
  candidateContentId: string,
  tenantId: string,
): Promise<PersistedContentMachineSnapshot | null> {
  const rows = (await tx
    .select()
    .from(contentStates)
    .where(and(eq(contentStates.candidateContentId, candidateContentId), eq(contentStates.tenantId, tenantId))
    )
    .orderBy(desc(contentStates.createdAt))
    .limit(1)) as ContentStateRow[];

  const stateRow = rows[0];

  if (!stateRow) {
    return null;
  }

  return parsePersistedState(stateRow.metadataJson, tenantId, candidateContentId);
}

export async function listContentCandidates(
  tx: PipelineTransaction,
  tenantId: string,
): Promise<CandidateContentWithState[]> {
  const candidates = (await tx
    .select()
    .from(candidateContent)
    .where(eq(candidateContent.tenantId, tenantId))
    .orderBy(desc(candidateContent.createdAt), desc(candidateContent.id))) as CandidateContentRow[];

  if (candidates.length === 0) {
    return [];
  }

  const candidateIds = candidates.map((candidate) => candidate.id);

  const states = (await tx
    .select()
    .from(contentStates)
    .where(
      and(eq(contentStates.tenantId, tenantId), inArray(contentStates.candidateContentId, candidateIds)),
    )
    .orderBy(
      contentStates.candidateContentId,
      desc(contentStates.createdAt),
      desc(contentStates.id),
    )) as ContentStateRow[];

  const latest = mapLatestStateRows(states);

  return candidates.map((candidate) => {
    const snapshotRow = latest.get(candidate.id);

    if (!snapshotRow) {
      const fallback = getInitialMachineSnapshot(tenantId, candidate.id);

      return {
        ...candidate,
        state: {
          state: fallback.state,
          context: fallback.context,
          serialized: fallback,
          actor: null,
          rejectionReason: null,
        },
      };
    }

    const snapshot = parsePersistedState(snapshotRow.metadataJson, tenantId, candidate.id);

    return {
      ...candidate,
      state: {
        state: snapshot.state,
        context: snapshot.context,
        serialized: snapshot,
        actor: snapshotRow.actor ?? null,
        rejectionReason: snapshotRow.rejectionReason ?? null,
      },
    };
  });
}

export async function createContentCandidate(
  tx: PipelineTransaction,
  tenantId: string,
  input: {
    sourceId: string;
    eventId?: string | null;
    photoId?: string | null;
    title: string;
    summaryJson?: Record<string, unknown>;
    selectedFormat: "post" | "story" | "carousel";
    selectedTone?: string;
    actor?: string;
  },
) {
  const inserted = (await tx
    .insert(candidateContent)
    .values({
      tenantId,
      sourceId: input.sourceId,
      eventId: input.eventId ?? null,
      photoId: input.photoId ?? null,
      title: input.title,
      summaryJson: input.summaryJson ?? {},
      selectedFormat: input.selectedFormat,
      selectedTone: input.selectedTone ?? null,
    })
    .returning()) as CandidateContentRow[];

  const content = inserted[0];

  if (!content) {
    throw new PipelineError("Could not create content piece.", "CREATE_FAILED");
  }

  const initialSnapshot = getInitialMachineSnapshot(tenantId, content.id);

  await tx.insert(contentStates).values({
    tenantId,
    candidateContentId: content.id,
    state: initialSnapshot.state,
    actor: input.actor,
    metadataJson: {
      ...initialSnapshot,
      transition: {
        from: null,
        to: initialSnapshot.state,
        event: "CREATE",
        actor: input.actor ?? null,
      },
    },
  });

  return {
    ...content,
    state: {
      state: initialSnapshot.state,
      context: initialSnapshot.context,
      serialized: initialSnapshot,
      actor: input.actor ?? null,
      rejectionReason: null,
    },
  };
}

export async function applyContentTransition(
  tx: PipelineTransaction,
  payload: ContentTransitionPayload,
): Promise<AppliedContentTransition> {
  const candidate = await getContentCandidate(tx, payload.candidateContentId, payload.tenantId);

  if (!candidate) {
    throw new ContentNotFoundError(payload.candidateContentId);
  }

  const currentSnapshot =
    (await getLatestSnapshotForCandidate(tx, payload.candidateContentId, payload.tenantId)) ??
    getInitialMachineSnapshot(payload.tenantId, payload.candidateContentId);

  const transition = applyMachineTransition(currentSnapshot, payload.event);
  const reason = extractReason(payload.event);

  if (transition.to === currentSnapshot.state) {
    return {
      from: currentSnapshot.state,
      to: transition.to,
      state: {
        state: currentSnapshot.state,
        context: currentSnapshot.context,
        serialized: currentSnapshot,
        actor: payload.actor ?? null,
        rejectionReason: currentSnapshot.state === "rejected" ? reason ?? null : null,
      },
    };
  }

  const nextSerialized = serializeMachineSnapshot({
    state: transition.to,
    context: transition.context,
  });
  const now = new Date();

  await tx
    .update(candidateContent)
    .set({
      status: resolveCandidateStatus(transition.to, payload.event),
      updatedAt: now,
    })
    .where(
      and(
        eq(candidateContent.id, payload.candidateContentId),
        eq(candidateContent.tenantId, payload.tenantId),
      ),
    );

  await tx.insert(contentStates).values({
    tenantId: payload.tenantId,
    candidateContentId: payload.candidateContentId,
    state: transition.to,
    actor: payload.actor,
    rejectionReason: reason,
    igPostId: payload.igPostId,
    metadataJson: {
      ...nextSerialized,
      transition: {
        from: currentSnapshot.state,
        to: transition.to,
        event: payload.event.type,
        actor: payload.actor ?? null,
      },
      reason: reason ?? null,
      reasonActor: payload.actor ?? null,
      happenedAt: now.toISOString(),
    },
  });

  return {
    from: currentSnapshot.state,
    to: transition.to,
    state: {
      state: nextSerialized.state,
      context: nextSerialized.context,
      serialized: nextSerialized,
      actor: payload.actor ?? null,
      rejectionReason: reason ?? null,
    },
    igPostId: payload.igPostId,
  };
}

export { ContentNotFoundError, InvalidTransitionError, PipelineError, resolveCandidateStatus };
export type { CandidateStatus, CandidateContentRow, ContentStateRow };
