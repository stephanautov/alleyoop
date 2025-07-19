// src/hooks/use-socket-enhanced.ts

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { usePageVisibility } from './use-page-visibility';

export function useSocketEnhanced() {
    const { status } = useSession();
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const [isPageVisible, setIsPageVisible] = useState(!document.hidden);

    // Handle page visibility
    usePageVisibility(
        () => {
            setIsPageVisible(true);
            // Reconnect if needed
            if (socketRef.current && !socketRef.current.connected) {
                socketRef.current.connect();
            }
        },
        () => {
            setIsPageVisible(false);
            // Don't disconnect, just note that page is hidden
        }
    );

    useEffect(() => {
        if (status !== 'authenticated') {
            return;
        }

        const initSocket = () => {
            if (socketRef.current?.connected) {
                return socketRef.current;
            }

            const socket = io({
                path: '/api/socket',
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: Infinity, // Keep trying on mobile
                // Mobile-specific options
                upgrade: true, // Start with polling, upgrade to websocket
                rememberUpgrade: true,
            });

            socket.on('connect', () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                setConnectionError(null);

                // Restore subscriptions if any
                const subscriptions = sessionStorage.getItem('socket_subscriptions');
                if (subscriptions) {
                    const docs = JSON.parse(subscriptions);
                    docs.forEach((docId: string) => {
                        socket.emit('subscribe:document', docId);
                    });
                }
            });

            socket.on('disconnect', (reason) => {
                console.log('WebSocket disconnected:', reason);
                setIsConnected(false);
            });

            socket.on('connect_error', (error) => {
                console.error('WebSocket connection error:', error.message);
                setConnectionError(error.message);
            });

            socketRef.current = socket;
            return socket;
        };

        const socket = initSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [status]);

    // Enhanced subscribe function that persists subscriptions
    const subscribe = (documentId: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('subscribe:document', documentId);

            // Persist subscription
            const existing = sessionStorage.getItem('socket_subscriptions');
            const subscriptions = existing ? JSON.parse(existing) : [];
            if (!subscriptions.includes(documentId)) {
                subscriptions.push(documentId);
                sessionStorage.setItem('socket_subscriptions', JSON.stringify(subscriptions));
            }
        }
    };

    const unsubscribe = (documentId: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('unsubscribe:document', documentId);

            // Remove from persisted subscriptions
            const existing = sessionStorage.getItem('socket_subscriptions');
            if (existing) {
                const subscriptions = JSON.parse(existing);
                const filtered = subscriptions.filter((id: string) => id !== documentId);
                sessionStorage.setItem('socket_subscriptions', JSON.stringify(filtered));
            }
        }
    };

    return {
        socket: socketRef.current,
        isConnected,
        connectionError,
        isPageVisible,
        subscribe,
        unsubscribe,
    };
}