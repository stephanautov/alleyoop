// src/server/websocket/index.ts

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { parse } from 'url';
import type { NextApiRequest } from 'next';
import { getToken } from 'next-auth/jwt';
import { Redis } from 'ioredis';
import { env } from '~/env';

// Global instance
let io: SocketIOServer | undefined;

export function getIO(): SocketIOServer {
    if (!io) {
        throw new Error('Socket.IO not initialized');
    }
    return io;
}

export function setupWebSocketServer(server: HTTPServer): SocketIOServer {
    if (io) {
        console.log('Socket.IO server already initialized');
        return io;
    }

    io = new SocketIOServer(server, {
        path: '/api/socket',
        addTrailingSlash: false,
        cors: {
            origin: env.NEXTAUTH_URL || 'http://localhost:3000',
            credentials: true,
        },
        transports: ['websocket', 'polling'], // Support both for mobile
    });

    // Redis for storing progress
    const redis = new Redis(env.REDIS_URL);

    // Authentication middleware
    io.use(async (socket: Socket, next) => {
        try {
            const req = socket.request as NextApiRequest;

            // Parse cookies from the socket handshake
            const cookies = parseCookies(socket.handshake.headers.cookie || '');
            req.cookies = cookies;

            // Verify JWT from cookies
            const token = await getToken({ req, secret: env.NEXTAUTH_SECRET });

            if (!token?.sub) {
                if (env.NODE_ENV === 'development') {
                    // allow anon in dev
                    socket.data.userId = 'anon';
                    return next();
                }
                return next(new Error('Unauthorized'));
            }

            socket.data.userId = token.sub;
            socket.data.userEmail = token.email;

            next();
        } catch (error) {
            console.error('Socket auth error:', error);
            next(new Error('Authentication failed'));
        }
    });

    // Connection handling
    io.on('connection', async (socket: Socket) => {
        const userId = socket.data.userId;
        console.log(`User ${userId} connected via WebSocket`);

        // Join user's personal room
        socket.join(`user:${userId}`);

        // Handle document subscriptions
        socket.on('subscribe:document', async (documentId: string) => {
            try {
                // Verify user has access to this document
                const hasAccess = await verifyDocumentAccess(userId, documentId);
                if (!hasAccess) {
                    socket.emit('error', { message: 'Access denied to document' });
                    return;
                }

                // Join document room
                socket.join(`document:${documentId}`);
                console.log(`User ${userId} subscribed to document ${documentId}`);

                // Send current progress if exists
                const progress = await redis.get(`progress:document:${documentId}`);
                if (progress) {
                    socket.emit('generation:progress', JSON.parse(progress));
                }
            } catch (error) {
                console.error('Subscription error:', error);
                socket.emit('error', { message: 'Failed to subscribe to document' });
            }
        });

        socket.on('unsubscribe:document', (documentId: string) => {
            socket.leave(`document:${documentId}`);
            console.log(`User ${userId} unsubscribed from document ${documentId}`);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected`);
        });
    });

    console.log('Socket.IO server initialized');
    return io;
}

// Helper functions
function parseCookies(cookieString: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    cookieString.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
            cookies[name] = decodeURIComponent(value);
        }
    });
    return cookies;
}

async function verifyDocumentAccess(userId: string, documentId: string): Promise<boolean> {
    // Import here to avoid circular dependency
    const { db } = await import('~/server/db');

    const document = await db.document.findFirst({
        where: {
            id: documentId,
            userId: userId,
        },
    });

    return !!document;
}