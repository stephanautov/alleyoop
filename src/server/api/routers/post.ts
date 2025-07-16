//src/server/api/routers/post.ts

import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.document.create({
        data: {
          userId: ctx.session.user.id,
          type: "BIOGRAPHY", // default type
          title: input.title,
          input: {},
        },
      });
    }),

  getLatest: protectedProcedure.query(async ({ ctx }) => {
    const doc = await ctx.db.document.findFirst({
      orderBy: { createdAt: "desc" },
      where: { userId: ctx.session.user.id },
    });

    return doc ?? null;
  }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
