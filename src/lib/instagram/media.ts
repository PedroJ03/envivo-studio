/**
 * Instagram media upload helpers and container status polling.
 *
 * Instagram's Graph API uses an asynchronous container model:
 * 1. Upload creates a "container" in PENDING state
 * 2. Poll the container status until it reaches FINISHED or ERROR
 * 3. Once FINISHED, call publishMedia to actually post
 *
 * This module handles the polling logic with configurable timeouts and retries.
 */

import { InstagramPublishError, InstagramTokenExpiredError } from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContainerStatus = "PENDING" | "FINISHED" | "ERROR" | "EXPIRED";

export interface ContainerPollResult {
  containerId: string;
  status: ContainerStatus;
  errorMessage?: string;
}

export interface PublishResult {
  instagramPostId: string;
  status: "published" | "failed";
  errorMessage?: string;
}

export interface CarouselPublishResult {
  instagramPostId: string;
  status: "published" | "failed";
  errorMessage?: string;
}

// ─── Container Status ─────────────────────────────────────────────────────────

const GRAPH_API_VERSION = process.env.INSTAGRAM_API_VERSION ?? "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface InstagramContainerResponse {
  id: string;
  status: ContainerStatus;
  status_code?: string;
  error_message?: string;
}

/**
 * Polls a container's status until it reaches FINISHED or ERROR.
 *
 * @param containerId - The container ID to poll
 * @param options - Polling configuration
 * @returns Final container state
 */
export async function pollContainerStatus(
  containerId: string,
  options?: {
    maxAttempts?: number;
    intervalMs?: number;
    accessToken: string;
  },
): Promise<ContainerPollResult> {
  const { maxAttempts = 30, intervalMs = 2000, accessToken = "" } = options ?? {};

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const status = await fetchContainerStatus(containerId, accessToken);

    if (status.status === "FINISHED") {
      return {
        containerId,
        status: "FINISHED",
      };
    }

    if (status.status === "ERROR" || status.status === "EXPIRED") {
      return {
        containerId,
        status: status.status,
        errorMessage: status.error_message ?? `Container reached ${status.status} state`,
      };
    }

    // Still pending, wait before next poll
    if (attempt < maxAttempts) {
      await sleep(intervalMs);
    }
  }

  return {
    containerId,
    status: "EXPIRED",
    errorMessage: `Container polling timed out after ${maxAttempts} attempts`,
  };
}

async function fetchContainerStatus(
  containerId: string,
  accessToken: string,
): Promise<InstagramContainerResponse> {
  const url = new URL(`${GRAPH_API_BASE}/${containerId}`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", "id,status,status_code,error_message");

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    if (error?.error?.code === 190) {
      throw new InstagramTokenExpiredError(null);
    }

    throw new InstagramPublishError(
      `Failed to fetch container status: ${error?.error?.error_user_msg ?? response.statusText}`,
      containerId,
    );
  }

  return response.json() as Promise<InstagramContainerResponse>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Full Publish Flow ────────────────────────────────────────────────────────

/**
 * Complete publish flow for a single image:
 * 1. Upload media
 * 2. Poll until container is FINISHED
 * 3. Publish the container
 *
 * @param imageUrl - URL of the image to publish
 * @param caption - Caption text
 * @param accessToken - Instagram access token
 */
export async function publishSingleImage(
  imageUrl: string,
  caption: string,
  accessToken: string,
): Promise<PublishResult> {
  // Import dynamically to avoid circular dependency issues at module load
  const { uploadMedia, publishMedia } = await import("./client");

  // Step 1: Upload media
  const uploadResult = await uploadMedia(imageUrl, caption);

  if ("dryRun" in uploadResult && uploadResult.dryRun) {
    return {
      instagramPostId: "dry-run-id",
      status: "published",
    };
  }

  const mediaResult = uploadResult as { containerId: string; status: string };

  // Step 2: Poll for container completion
  const pollResult = await pollContainerStatus(mediaResult.containerId, {
    accessToken,
    maxAttempts: 30,
    intervalMs: 2000,
  });

  if (pollResult.status !== "FINISHED") {
    return {
      instagramPostId: "",
      status: "failed",
      errorMessage: pollResult.errorMessage ?? `Container status: ${pollResult.status}`,
    };
  }

  // Step 3: Publish
  const publishResult = await publishMedia(mediaResult.containerId);

  if ("dryRun" in publishResult && publishResult.dryRun) {
    return {
      instagramPostId: "dry-run-id",
      status: "published",
    };
  }

  return {
    instagramPostId: (publishResult as { instagramPostId: string }).instagramPostId,
    status: "published",
  };
}

/**
 * Complete publish flow for a carousel:
 * 1. Upload each image
 * 2. Create carousel container
 * 3. Poll carousel container until FINISHED
 * 4. Publish the carousel
 *
 * @param imageUrls - Array of image URLs for carousel slides
 * @param caption - Caption text
 * @param accessToken - Instagram access token
 */
export async function publishCarousel(
  imageUrls: string[],
  caption: string,
  accessToken: string,
): Promise<CarouselPublishResult> {
  const { uploadMediaForCarousel, createCarouselContainer, publishMedia } = await import("./client");

  // Step 1: Upload all images
  const uploadResult = await uploadMediaForCarousel(imageUrls);

  if ("dryRun" in uploadResult && uploadResult.dryRun) {
    return {
      instagramPostId: "dry-run-carousel-id",
      status: "published",
    };
  }

  const { containerIds } = uploadResult as { containerIds: string[] };

  // Step 2: Create carousel container
  const carouselResult = await createCarouselContainer(containerIds, caption);

  if ("dryRun" in carouselResult && carouselResult.dryRun) {
    return {
      instagramPostId: "dry-run-carousel-id",
      status: "published",
    };
  }

  const carouselContainerId = (carouselResult as { containerId: string }).containerId;

  // Step 3: Poll carousel container until FINISHED
  const pollResult = await pollContainerStatus(carouselContainerId, {
    accessToken,
    maxAttempts: 30,
    intervalMs: 2000,
  });

  if (pollResult.status !== "FINISHED") {
    return {
      instagramPostId: "",
      status: "failed",
      errorMessage: pollResult.errorMessage ?? `Carousel container status: ${pollResult.status}`,
    };
  }

  // Step 4: Publish the carousel
  const publishResult = await publishMedia(carouselContainerId);

  if ("dryRun" in publishResult && publishResult.dryRun) {
    return {
      instagramPostId: "dry-run-carousel-id",
      status: "published",
    };
  }

  return {
    instagramPostId: (publishResult as { instagramPostId: string }).instagramPostId,
    status: "published",
  };
}

// ─── Error Classes ────────────────────────────────────────────────────────────

export class ContainerStatusError extends InstagramPublishError {
  public readonly containerStatus: ContainerStatus;

  constructor(message: string, containerId: string, containerStatus: ContainerStatus) {
    super(message, containerId);
    this.name = "ContainerStatusError";
    this.containerStatus = containerStatus;
  }
}
