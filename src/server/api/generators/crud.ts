import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import type { Prisma } from "@prisma/client";

// Generic CRUD input schemas
const paginationSchema = z.object({
    limit: z.number().min(1).max(100).default(10),
    cursor: z.string().optional(),
});

const orderBySchema = z.object({
    field: z.string(),
    direction: z.enum(["asc", "desc"]).default("desc"),
});

const filtersSchema = z.record(z.unknown()).optional();

export interface CRUDGeneratorOptions<TModel extends string> {
    modelName: TModel;
    createSchema: z.ZodSchema;
    updateSchema: z.ZodSchema;
    defaultOrderBy?: Record<string, "asc" | "desc">;
    defaultWhere?: Record<string, unknown>;
    includeRelations?: Record<string, boolean>;
    allowPublicRead?: boolean;
    beforeCreate?: (data: any, ctx: any) => Promise<any> | any;
    afterCreate?: (data: any, ctx: any) => Promise<void> | void;
    beforeUpdate?: (id: string, data: any, ctx: any) => Promise<any> | any;
    afterUpdate?: (data: any, ctx: any) => Promise<void> | void;
    beforeDelete?: (id: string, ctx: any) => Promise<void> | void;
    afterDelete?: (id: string, ctx: any) => Promise<void> | void;
}

/**
 * Generic CRUD Router Generator
 * Creates a complete CRUD API for any Prisma model
 */
export function createCRUDRouter<TModel extends string>(
    options: CRUDGeneratorOptions<TModel>
) {
    const {
        modelName,
        createSchema,
        updateSchema,
        defaultOrderBy = { createdAt: "desc" },
        defaultWhere = {},
        includeRelations = {},
        allowPublicRead = false,
        beforeCreate,
        afterCreate,
        beforeUpdate,
        afterUpdate,
        beforeDelete,
        afterDelete,
    } = options;

    // Use the appropriate procedure based on whether public read is allowed
    const readProcedure = allowPublicRead ? publicProcedure : protectedProcedure;

    return createTRPCRouter({
        // Create
        create: protectedProcedure
            .input(createSchema)
            .mutation(async ({ ctx, input }) => {
                // Apply before create hook if provided
                const processedInput = beforeCreate
                    ? await beforeCreate(input, ctx)
                    : input;

                // Add user association if user is in context
                const dataWithUser = ctx.session?.user
                    ? { ...processedInput, userId: ctx.session.user.id }
                    : processedInput;

                const created = await (ctx.db[modelName as any] as any).create({
                    data: dataWithUser,
                    include: includeRelations,
                });

                // Apply after create hook if provided
                if (afterCreate) {
                    await afterCreate(created, ctx);
                }

                return created;
            }),

        // Read One
        getById: readProcedure
            .input(z.object({ id: z.string() }))
            .query(async ({ ctx, input }) => {
                const where: any = { id: input.id, ...defaultWhere };

                // Add user filter for protected routes
                if (!allowPublicRead && ctx.session?.user) {
                    where.userId = ctx.session.user.id;
                }

                const item = await (ctx.db[modelName as any] as any).findUnique({
                    where,
                    include: includeRelations,
                });

                if (!item) {
                    throw new Error(`${modelName} not found`);
                }

                return item;
            }),

        // Read Many (with pagination)
        list: readProcedure
            .input(
                z.object({
                    pagination: paginationSchema.optional(),
                    orderBy: orderBySchema.optional(),
                    filters: filtersSchema,
                })
            )
            .query(async ({ ctx, input }) => {
                const { pagination, orderBy, filters = {} } = input;

                // Build where clause
                const where: any = { ...defaultWhere, ...filters };

                // Add user filter for protected routes
                if (!allowPublicRead && ctx.session?.user) {
                    where.userId = ctx.session.user.id;
                }

                // Build order by
                const order = orderBy
                    ? { [orderBy.field]: orderBy.direction }
                    : defaultOrderBy;

                // Query with pagination
                const findManyArgs: any = {
                    where,
                    orderBy: order,
                    include: includeRelations,
                    take: pagination?.limit ?? 10,
                };

                // Add cursor-based pagination if cursor is provided
                if (pagination?.cursor) {
                    findManyArgs.cursor = { id: pagination.cursor };
                    findManyArgs.skip = 1;
                }

                const items = await (ctx.db[modelName as any] as any).findMany(
                    findManyArgs
                );

                // Get total count for pagination info
                const totalCount = await (ctx.db[modelName as any] as any).count({
                    where,
                });

                // Determine next cursor
                const lastItem = items[items.length - 1];
                const nextCursor = lastItem?.id ?? null;

                return {
                    items,
                    nextCursor,
                    totalCount,
                    hasMore: items.length === (pagination?.limit ?? 10),
                };
            }),

        // Update
        update: protectedProcedure
            .input(
                z.object({
                    id: z.string(),
                    data: updateSchema,
                })
            )
            .mutation(async ({ ctx, input }) => {
                // Verify ownership
                const existing = await (ctx.db[modelName as any] as any).findUnique({
                    where: { id: input.id },
                    select: { userId: true },
                });

                if (!existing) {
                    throw new Error(`${modelName} not found`);
                }

                if (existing.userId !== ctx.session.user.id) {
                    throw new Error("Unauthorized");
                }

                // Apply before update hook if provided
                const processedData = beforeUpdate
                    ? await beforeUpdate(input.id, input.data, ctx)
                    : input.data;

                const updated = await (ctx.db[modelName as any] as any).update({
                    where: { id: input.id },
                    data: processedData,
                    include: includeRelations,
                });

                // Apply after update hook if provided
                if (afterUpdate) {
                    await afterUpdate(updated, ctx);
                }

                return updated;
            }),

        // Delete
        delete: protectedProcedure
            .input(z.object({ id: z.string() }))
            .mutation(async ({ ctx, input }) => {
                // Verify ownership
                const existing = await (ctx.db[modelName as any] as any).findUnique({
                    where: { id: input.id },
                    select: { userId: true },
                });

                if (!existing) {
                    throw new Error(`${modelName} not found`);
                }

                if (existing.userId !== ctx.session.user.id) {
                    throw new Error("Unauthorized");
                }

                // Apply before delete hook if provided
                if (beforeDelete) {
                    await beforeDelete(input.id, ctx);
                }

                await (ctx.db[modelName as any] as any).delete({
                    where: { id: input.id },
                });

                // Apply after delete hook if provided
                if (afterDelete) {
                    await afterDelete(input.id, ctx);
                }

                return { success: true, id: input.id };
            }),

        // Bulk operations
        createMany: protectedProcedure
            .input(z.array(createSchema))
            .mutation(async ({ ctx, input }) => {
                const dataWithUser = input.map((item) => ({
                    ...item,
                    userId: ctx.session.user.id,
                }));

                const result = await (ctx.db[modelName as any] as any).createMany({
                    data: dataWithUser,
                    skipDuplicates: true,
                });

                return result;
            }),

        deleteMany: protectedProcedure
            .input(z.object({ ids: z.array(z.string()) }))
            .mutation(async ({ ctx, input }) => {
                // Verify ownership of all items
                const existing = await (ctx.db[modelName as any] as any).findMany({
                    where: {
                        id: { in: input.ids },
                        userId: ctx.session.user.id,
                    },
                    select: { id: true },
                });

                const existingIds = existing.map((item: any) => item.id);
                const unauthorizedIds = input.ids.filter(
                    (id) => !existingIds.includes(id)
                );

                if (unauthorizedIds.length > 0) {
                    throw new Error(
                        `Unauthorized to delete items: ${unauthorizedIds.join(", ")}`
                    );
                }

                const result = await (ctx.db[modelName as any] as any).deleteMany({
                    where: {
                        id: { in: input.ids },
                        userId: ctx.session.user.id,
                    },
                });

                return { success: true, count: result.count };
            }),

        // Search functionality
        search: readProcedure
            .input(
                z.object({
                    query: z.string().min(1),
                    fields: z.array(z.string()),
                    pagination: paginationSchema.optional(),
                })
            )
            .query(async ({ ctx, input }) => {
                const { query, fields, pagination } = input;

                // Build search conditions
                const searchConditions = fields.map((field) => ({
                    [field]: {
                        contains: query,
                        mode: "insensitive" as const,
                    },
                }));

                const where: any = {
                    AND: [
                        defaultWhere,
                        {
                            OR: searchConditions,
                        },
                    ],
                };

                // Add user filter for protected routes
                if (!allowPublicRead && ctx.session?.user) {
                    where.AND.push({ userId: ctx.session.user.id });
                }

                const items = await (ctx.db[modelName as any] as any).findMany({
                    where,
                    orderBy: defaultOrderBy,
                    include: includeRelations,
                    take: pagination?.limit ?? 10,
                    ...(pagination?.cursor && {
                        cursor: { id: pagination.cursor },
                        skip: 1,
                    }),
                });

                const totalCount = await (ctx.db[modelName as any] as any).count({
                    where,
                });

                const lastItem = items[items.length - 1];
                const nextCursor = lastItem?.id ?? null;

                return {
                    items,
                    nextCursor,
                    totalCount,
                    hasMore: items.length === (pagination?.limit ?? 10),
                };
            }),
    });
}

// Type helper for inferring router type
export type CRUDRouter<TModel extends string> = ReturnType<
    typeof createCRUDRouter<TModel>
>;