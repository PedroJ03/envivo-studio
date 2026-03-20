import { inngestClient } from "@/inngest/client";
import { scrapeEventFunction } from "./functions/scrape-event";
import { contentPipelineFunctions } from "./functions/pipeline";
import { instagramPublishFunction } from "./functions/publish-instagram";

export const functions = [scrapeEventFunction];

// Foundation placeholder for future pipeline functions.
// Keep this file as the registry entry consumed by the Inngest route handler.
export const inngestFunctionRegistry = [
  ...functions,
  ...contentPipelineFunctions,
  instagramPublishFunction,
];

export { inngestClient };
