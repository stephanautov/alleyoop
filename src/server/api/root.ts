//src/server/api/root.ts

import { createTRPCRouter } from "~/server/api/trpc";
import { documentRouter } from "./routers/document";
import { exportRouter } from "./routers/export";
import { userRouter } from "./routers/user";
import { templateRouter } from "./routers/template";
import { usageRouter } from "./routers/usage";
import { healthRouter } from "./routers/health";
import { postRouter } from "./routers/post";
import { enhancedGeneratorsRouter as generatorsRouter } from "./routers/generators-enhanced";
import { preferencesRouter } from "./routers/preferences";
import { knowledgeRouter } from "./routers/knowledge";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  document: documentRouter,
  export: exportRouter,
  user: userRouter,
  template: templateRouter,
  usage: usageRouter,
  health: healthRouter,
  post: postRouter,
  generators: generatorsRouter,
  preferences: preferencesRouter,
  knowledge: knowledgeRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = appRouter.createCaller;
