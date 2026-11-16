import { useState, useEffect, useCallback } from 'react';
import { portalSystemService } from '../services/api';

/**
 * usePimsStatus:
 * Hook to dynamically track whether the PIMS system is active or inactive in the portal system catalog.
 * - Active: Triggers the new Generate PR modal workflow.
 * - Inactive: Reverts to the PIMS Publish Confirmation & Procurement Input modal (PimsPublishModal),
 *             with NO Generate PR modal shown.
 */
export const usePimsStatus = () => {
    const [isPimsActive, setIsPimsActive] = useState(true);
    const [loading, setLoading] = useState(true);

    const checkStatus = useCallback(async () => {
        try {
            const res = await portalSystemService.getPimsStatus();
            if (res.data && res.data.is_active !== undefined) {
                setIsPimsActive(Boolean(res.data.is_active));
            } else {
                // Fallback to checking public portal systems
                const pub = await portalSystemService.getPublic();
                const list = Array.isArray(pub.data) ? pub.data : [];
                const found = list.some(
                    (s) => s.link_url === '/pims' || s.link_url?.includes('pims') || s.name?.toLowerCase().includes('pims')
                );
                setIsPimsActive(found);
            }
        } catch (err) {
            console.error('Failed to query PIMS status:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkStatus();

        const handleSync = () => checkStatus();
        window.addEventListener('portal-systems:updated', handleSync);
        window.addEventListener('pims:status_changed', handleSync);

        return () => {
            window.removeEventListener('portal-systems:updated', handleSync);
            window.removeEventListener('pims:status_changed', handleSync);
        };
    }, [checkStatus]);

    return { isPimsActive, loading, refreshPimsStatus: checkStatus };
};

