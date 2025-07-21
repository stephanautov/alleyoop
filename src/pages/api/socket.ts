// src/pages/api/socket.ts
import { Server as IOServer } from "socket.io";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: false } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!res.socket) return res.status(500).end();

    if (!(res.socket as any).server.io) {
        const io = new IOServer((res.socket as any).server, {
            path: "/api/socket",
            addTrailingSlash: false,
            cors: { origin: "*" },
        });

        io.on("connection", (socket) => {
            console.log("Socket connected", socket.id);
        });

        (res.socket as any).server.io = io;
        console.log("Socket.IO server started on /api/socket (src/pages)");
    }

    res.end();
} 