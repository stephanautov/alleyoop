// src/components/providers/socket-provider.tsx

import { createContext, useContext, useEffect } from 'react';
import { useSocket } from '~/hooks/use-socket';
import type { Socket } from 'socket.io-client';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    connectionError: string | null;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    connectionError: null,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const socketData = useSocket();

    return (
        <SocketContext.Provider value={socketData}>
            {children}
        </SocketContext.Provider>
    );
}

export const useSocketContext = () => useContext(SocketContext);