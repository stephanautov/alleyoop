import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

let socketInstance: Socket | null = null;

export function useSocket() {
    const { status } = useSession();
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const reconnectAttemptsRef = useRef(0);

    useEffect(() => {
        if (status !== 'authenticated') {
            return;
        }

        const initSocket = () => {
            if (socketInstance?.connected) {
                return socketInstance;
            }

            socketInstance = io({
                path: '/api/socket',
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: 5,
            });

            socketInstance.on('connect', () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                setConnectionError(null);
                reconnectAttemptsRef.current = 0;
            });

            socketInstance.on('disconnect', (reason) => {
                console.log('WebSocket disconnected:', reason);
                setIsConnected(false);

                if (reason === 'io server disconnect') {
                    // Server disconnected us, try to reconnect
                    socketInstance?.connect();
                }
            });

            socketInstance.on('connect_error', (error) => {
                console.error('WebSocket connection error:', error.message);
                setConnectionError(error.message);

                // Implement exponential backoff for reconnection
                reconnectAttemptsRef.current++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);

                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = setTimeout(() => {
                    socketInstance?.connect();
                }, delay);
            });

            socketInstance.on('error', (error) => {
                console.error('WebSocket error:', error);
                setConnectionError(error.message || 'Unknown error');
            });

            return socketInstance;
        };

        const socket = initSocket();

        return () => {
            clearTimeout(reconnectTimeoutRef.current);
        };
    }, [status]);

    return {
        socket: socketInstance,
        isConnected,
        connectionError,
    };
}