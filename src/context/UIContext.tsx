'use client'

import React, { createContext, useContext, useState } from 'react'

interface UIContextType {
    isFullscreen: boolean
    toggleFullscreen: () => void
    setFullscreen: (value: boolean) => void
}

const UIContext = createContext<UIContextType | undefined>(undefined)

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Sync state with browser fullscreen changes (e.g., user presses Esc)
    // Sync state with browser fullscreen changes (e.g., user presses Esc)
    React.useEffect(() => {
        const handleFullscreenChange = () => {
            const isDocFullscreen = !!document.fullscreenElement;
            setIsFullscreen(isDocFullscreen);
            // Force 100% zoom in Chrome when in fullscreen
            if (isDocFullscreen) {
                (document.body.style as any).zoom = "100%";
            } else {
                (document.body.style as any).zoom = "";
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            // Cleanup on unmount
            (document.body.style as any).zoom = "";
        }
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                // State will be updated by the event listener
            } else {
                await document.exitFullscreen();
                // State will be updated by the event listener
            }
        } catch (err) {
            console.error("Error toggling fullscreen:", err);
        }
    }

    const setFullscreen = async (value: boolean) => {
        try {
            if (value && !document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else if (!value && document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error("Error setting fullscreen:", err);
        }
    }

    return (
        <UIContext.Provider value={{ isFullscreen, toggleFullscreen, setFullscreen }}>
            {children}
        </UIContext.Provider>
    )
}

export function useUI() {
    const context = useContext(UIContext)
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider')
    }
    return context
}
