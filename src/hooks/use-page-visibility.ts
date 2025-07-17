// src/hooks/use-page-visibility.ts

import { useEffect, useRef } from 'react';

export function usePageVisibility(
    onVisible?: () => void,
    onHidden?: () => void
) {
    const onVisibleRef = useRef(onVisible);
    const onHiddenRef = useRef(onHidden);

    useEffect(() => {
        onVisibleRef.current = onVisible;
        onHiddenRef.current = onHidden;
    }, [onVisible, onHidden]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                onHiddenRef.current?.();
            } else {
                onVisibleRef.current?.();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Handle Safari iOS
        window.addEventListener('pageshow', () => onVisibleRef.current?.());
        window.addEventListener('pagehide', () => onHiddenRef.current?.());

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pageshow', () => onVisibleRef.current?.());
            window.removeEventListener('pagehide', () => onHiddenRef.current?.());
        };
    }, []);
}