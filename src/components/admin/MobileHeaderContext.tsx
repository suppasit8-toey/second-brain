'use client'

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface MobileHeaderContextType {
    mountNode: HTMLElement | null;
    setMountNode: (node: HTMLElement | null) => void;
}

const MobileHeaderContext = createContext<MobileHeaderContextType>({
    mountNode: null,
    setMountNode: () => { },
});

export const MobileHeaderProvider = ({ children }: { children: ReactNode }) => {
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

    return (
        <MobileHeaderContext.Provider value={{ mountNode, setMountNode }}>
            {children}
        </MobileHeaderContext.Provider>
    );
};

export const MobileHeaderActions = ({ children }: { children: ReactNode }) => {
    const { mountNode } = useContext(MobileHeaderContext);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !mountNode) return null;

    return createPortal(
        children,
        mountNode
    );
};

export const MobileHeaderTarget = ({ className }: { className?: string }) => {
    const { setMountNode } = useContext(MobileHeaderContext);

    return (
        <div
            ref={setMountNode}
            className={className}
        />
    );
};
