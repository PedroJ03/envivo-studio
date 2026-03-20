import { Inngest } from "inngest";

export const inngestClient = new Inngest({
  id: "envivo-studio",
  name: "envivo-studio pipeline",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
