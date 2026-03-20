import { serve } from "inngest/next";
import { inngestClient } from "@/inngest/client";
import { inngestFunctionRegistry } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngestClient,
  functions: inngestFunctionRegistry,
});
