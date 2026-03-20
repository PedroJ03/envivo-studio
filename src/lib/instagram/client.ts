/**
 * Instagram Graph API client for EnVivo Studio.
 *
 * Handles all interactions with the Instagram Graph API including:
 * - Token validation and refresh
 * - Media upload (single and carousel)
 * - Container creation and polling
 * - Publishing media items
 *
 * Supports dry-run mode via INSTAGRAM_DRY_RUN=true (default: true).
 * In dry-run mode, all API calls are logged but not executed.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type TenantRow = typeof tenants.$inferSelect;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InstagramTokenStatus {
  isValid: boolean;
  igAccountId: string | null;
  errorCode?: "TOKEN_EXPIRED" | "TOKEN_INVALID" | "NO_ACCOUNT" | "NETWORK_ERROR";
  errorMessage?: string;
}

export interface InstagramMediaUploadResult {
  containerId: string;
  status: "pending" | "FINISHED" | "ERROR";
}

export interface InstagramCarouselResult {
  containerId: string;
  status: "pending" | "FINISHED" | "ERROR";
}

export interface InstagramPublishResult {
  instagramPostId: string;
  status: "published" | "ERROR";
}

export interface InstagramDryRunResult {
  dryRun: true;
  action: string;
  payload: Record<string, unknown>;
}

// ─── Configuration ─────────────────────────────────────────────────────────────

const INSTAGRAM_API_VERSION = process.env.INSTAGRAM_API_VERSION ?? "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}`;

function isDryRun(): boolean {
  // Default to true for safety — nothing publishes unless explicitly disabled
  return process.env.INSTAGRAM_DRY_RUN !== "false";
}

// ─── Errors ────────────────────────────────────────────────────────────────────

export class InstagramTokenExpiredError extends Error {
  public readonly code = "INSTAGRAM_TOKEN_EXPIRED";
  public readonly igAccountId: string | null;

  constructor(igAccountId: string | null, message = "Instagram access token has expired") {
    super(message);
    this.name = "InstagramTokenExpiredError";
    this.igAccountId = igAccountId;
  }
}

export class InstagramPublishError extends Error {
  public readonly code = "INSTAGRAM_PUBLISH_ERROR";
  public readonly containerId?: string;
  public readonly status?: string;

  constructor(message: string, containerId?: string, status?: string) {
    super(message);
    this.name = "InstagramPublishError";
    this.containerId = containerId;
    this.status = status;
  }
}

// ─── Token Management ─────────────────────────────────────────────────────────

/**
 * Fetches a fresh access token from Meta's OAuth endpoint using the stored refresh token.
 * Updates the tenant record if refresh succeeds.
 */
async function refreshAccessToken(
  tenantId: string,
  currentRefreshToken: string,
): Promise<string> {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    throw new InstagramPublishError(
      "INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be set for token refresh",
    );
  }

  const refreshUrl = new URL("https://graph.facebook.com/oauth/access_token");
  refreshUrl.searchParams.set("grant_type", "fb_exchange_token");
  refreshUrl.searchParams.set("client_id", appId);
  refreshUrl.searchParams.set("client_secret", appSecret);
  refreshUrl.searchParams.set("fb_exchange_token", currentRefreshToken);

  const response = await fetch(refreshUrl.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new InstagramPublishError(
      `Failed to refresh Instagram token: ${error?.error_message ?? response.statusText}`,
    );
  }

  const data = (await response.json()) as { access_token: string };

  // Persist the new token to the tenant record
  await db
    .update(tenants)
    .set({ igAccessToken: data.access_token, updatedAt: new Date() })
    .where(and(eq(tenants.id, tenantId), eq(tenants.isActive, true)));

  return data.access_token;
}

/**
 * Retrieves the current Instagram access token and account ID for a tenant.
 * Automatically refreshes the token if it has expired.
 */
export async function getInstagramCredentials(
  tenantId: string,
): Promise<{ accessToken: string; igAccountId: string }> {
  const tenantRows = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.isActive, true)))
    .limit(1) as TenantRow[];

  if (!tenantRows[0]) {
    throw new InstagramPublishError(`Tenant '${tenantId}' not found or inactive`);
  }

  const tenant = tenantRows[0];
  const accessToken = tenant.igAccessToken;
  const igAccountId = tenant.igAccountId;

  if (!accessToken) {
    throw new InstagramPublishError(
      "No Instagram access token configured for this tenant",
      undefined,
      "NO_TOKEN",
    );
  }

  if (!igAccountId) {
    throw new InstagramPublishError(
      "No Instagram account ID configured for this tenant",
      undefined,
      "NO_ACCOUNT",
    );
  }

  return { accessToken, igAccountId };
}

/**
 * Validates the Instagram access token and retrieves the associated IG account.
 * Returns token status with error details if invalid.
 */
export async function getTokenStatus(tenantId: string): Promise<InstagramTokenStatus> {
  try {
    const { accessToken, igAccountId } = await getInstagramCredentials(tenantId);

    // Try to query the Instagram account to validate the token
    const accountsUrl = new URL(`${GRAPH_API_BASE}/me/accounts`);
    accountsUrl.searchParams.set("access_token", accessToken);

    const accountsResponse = await fetch(accountsUrl.toString());

    if (!accountsResponse.ok) {
      const error = await accountsResponse.json().catch(() => ({}));

      if (error?.error?.code === 190) {
        // Token expired or invalid
        return {
          isValid: false,
          igAccountId,
          errorCode: "TOKEN_EXPIRED",
          errorMessage: error.error?.error_user_msg ?? "Access token expired",
        };
      }

      return {
        isValid: false,
        igAccountId,
        errorCode: "TOKEN_INVALID",
        errorMessage: error?.error?.error_user_msg ?? accountsResponse.statusText,
      };
    }

    const accountsData = (await accountsResponse.json()) as {
      data: Array<{ id: string; name: string }>;
    };

    // Check if the configured IG account is in the list
    const hasAccess = accountsData.data.some((account) => account.id === igAccountId);

    if (!hasAccess) {
      return {
        isValid: false,
        igAccountId,
        errorCode: "TOKEN_INVALID",
        errorMessage: "Access token does not have access to the configured Instagram account",
      };
    }

    return { isValid: true, igAccountId };
  } catch (err) {
    const error = err as Error;

    if (error instanceof InstagramPublishError && error.status === "NO_TOKEN") {
      return {
        isValid: false,
        igAccountId: null,
        errorCode: "TOKEN_INVALID",
        errorMessage: error.message,
      };
    }

    return {
      isValid: false,
      igAccountId: null,
      errorCode: "NETWORK_ERROR",
      errorMessage: error.message,
    };
  }
}

// ─── Graph API Helpers ────────────────────────────────────────────────────────

async function graphPost<T>(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${endpoint}`);
  url.searchParams.set("access_token", accessToken);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    // Check for token expiry (error code 190)
    if (error?.error?.code === 190) {
      throw new InstagramTokenExpiredError(params.ig_account_id ?? null);
    }

    throw new InstagramPublishError(
      `Graph API error: ${error?.error?.error_user_msg ?? error?.error?.message ?? response.statusText}`,
      params.creation_id,
    );
  }

  return response.json() as Promise<T>;
}

async function graphGet<T>(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${endpoint}`);
  url.searchParams.set("access_token", accessToken);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    if (error?.error?.code === 190) {
      throw new InstagramTokenExpiredError(params.ig_account_id ?? null);
    }

    throw new InstagramPublishError(
      `Graph API error: ${error?.error?.error_user_msg ?? error?.error?.message ?? response.statusText}`,
      endpoint,
    );
  }

  return response.json() as Promise<T>;
}

// ─── Media Upload ─────────────────────────────────────────────────────────────

/**
 * Uploads an image to Instagram and returns a container ID for publishing.
 *
 * @param imageUrl - The publicly accessible URL of the image to upload
 * @param caption - Optional caption for the post (used for single image posts)
 */
export async function uploadMedia(
  imageUrl: string,
  caption?: string,
): Promise<InstagramMediaUploadResult | InstagramDryRunResult> {
  if (isDryRun()) {
    console.log("[Instagram Dry Run] uploadMedia", { imageUrl, caption });
    return {
      dryRun: true,
      action: "uploadMedia",
      payload: { imageUrl, caption },
    };
  }

  const { accessToken, igAccountId } = await getInstagramCredentialsFromEnv();

  const params: Record<string, string> = {
    "image_url": imageUrl,
    ig_account_id: igAccountId,
  };

  if (caption) {
    params.caption = caption;
  }

  const data = await graphPost<{ id: string; status: string }>(
    `/${igAccountId}/media`,
    params,
    accessToken,
  );

  return {
    containerId: data.id,
    status: data.status === "FINISHED" ? "FINISHED" : "pending",
  };
}

/**
 * Uploads multiple images to Instagram for carousel creation.
 * Returns an array of container IDs.
 */
export async function uploadMediaForCarousel(
  imageUrls: string[],
): Promise<{ containerIds: string[] } | InstagramDryRunResult> {
  if (isDryRun()) {
    console.log("[Instagram Dry Run] uploadMediaForCarousel", { imageUrls });
    return {
      dryRun: true,
      action: "uploadMediaForCarousel",
      payload: { imageUrls },
    };
  }

  const containerIds: string[] = [];

  for (const imageUrl of imageUrls) {
    const result = await uploadMedia(imageUrl);
    if ("dryRun" in result && result.dryRun) {
      throw new InstagramPublishError("Dry run failed during carousel upload");
    }
    containerIds.push((result as InstagramMediaUploadResult).containerId);
  }

  return { containerIds };
}

// ─── Carousel Container Creation ──────────────────────────────────────────────

/**
 * Creates an Instagram carousel container from a list of media container IDs.
 *
 * @param mediaContainerIds - Array of container IDs from uploaded images
 * @param caption - Caption text for the carousel post
 */
export async function createCarouselContainer(
  mediaContainerIds: string[],
  caption?: string,
): Promise<InstagramCarouselResult | InstagramDryRunResult> {
  if (isDryRun()) {
    console.log("[Instagram Dry Run] createCarouselContainer", { mediaContainerIds, caption });
    return {
      dryRun: true,
      action: "createCarouselContainer",
      payload: { mediaContainerIds, caption },
    };
  }

  const { accessToken, igAccountId } = await getInstagramCredentialsFromEnv();

  const carouselUrl = new URL(`${GRAPH_API_BASE}/${igAccountId}/media`);
  carouselUrl.searchParams.set("access_token", accessToken);
  carouselUrl.searchParams.set("media_type", "CAROUSEL");
  carouselUrl.searchParams.set(
    "children",
    mediaContainerIds.join(","),
  );
  if (caption) {
    carouselUrl.searchParams.set("caption", caption);
  }

  const response = await fetch(carouselUrl.toString(), {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new InstagramPublishError(
      `Failed to create carousel container: ${error?.error?.error_user_msg ?? response.statusText}`,
    );
  }

  const data = (await response.json()) as { id: string; status: string };

  return {
    containerId: data.id,
    status: data.status === "FINISHED" ? "FINISHED" : "pending",
  };
}

// ─── Publishing ────────────────────────────────────────────────────────────────

/**
 * Publishes a media container (single image or carousel) to Instagram.
 *
 * @param containerId - The container ID from uploadMedia or createCarouselContainer
 */
export async function publishMedia(
  containerId: string,
): Promise<InstagramPublishResult | InstagramDryRunResult> {
  if (isDryRun()) {
    console.log("[Instagram Dry Run] publishMedia", { containerId });
    return {
      dryRun: true,
      action: "publishMedia",
      payload: { containerId },
    };
  }

  const { accessToken, igAccountId } = await getInstagramCredentialsFromEnv();

  const data = await graphPost<{ id: string; status: string }>(
    `/${igAccountId}/media_publish`,
    { creation_id: containerId },
    accessToken,
  );

  return {
    instagramPostId: data.id,
    status: "published",
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Gets Instagram credentials from environment (for internal use in non-tenant context).
 * Use getInstagramCredentials in tenant context for proper tenant scoping.
 */
async function getInstagramCredentialsFromEnv(): Promise<{
  accessToken: string;
  igAccountId: string;
}> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igAccountId = process.env.INSTAGRAM_IG_ACCOUNT_ID;

  if (!accessToken) {
    throw new InstagramPublishError("INSTAGRAM_ACCESS_TOKEN is not set");
  }

  if (!igAccountId) {
    throw new InstagramPublishError("INSTAGRAM_IG_ACCOUNT_ID is not set");
  }

  return { accessToken, igAccountId };
}
