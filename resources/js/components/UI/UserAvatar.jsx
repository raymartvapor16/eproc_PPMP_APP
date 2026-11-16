import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, User, Maximize2 } from 'lucide-react';
import { userService } from '../../services/api';

/**
 * Reusable User Avatar Component
 * Displays user profile image from secure backend storage, with automatic fallback
 * to a stylish first-letter initial badge if no image exists or if load fails.
 * Supports click-to-expand lightbox preview.
 */
export const UserAvatar = ({
    user = null,
    userId = null,
    photoUrl = null,
    name = '',
    role = '',
    designation = '',
    size = 'md', // 'xs', 'sm', 'md', 'lg', 'xl'
    canExpand = true,
    className = '',
    timestamp = null,
}) => {
    const [imageError, setImageError] = useState(false);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    const targetId = user?.id || userId;
    const targetName = user?.name || name || 'User';
    const initial = targetName.charAt(0).toUpperCase() || 'U';

    // A user only has a photo if photoUrl, user.profile_photo_path, or user.profile_photo_url is present
    const hasPhoto = Boolean(
        photoUrl ||
        user?.profile_photo_path ||
        user?.profile_photo_url
    );

    // Only set avatarUrl if hasPhoto is true and hasn't errored
    const avatarUrl = (hasPhoto && !imageError)
        ? (photoUrl || (targetId ? `${userService.getUserAvatarUrl(targetId)}${timestamp ? `?t=${timestamp}` : ''}` : null))
        : null;

    const sizeClasses = {
        xs: 'w-6 h-6 text-[10px]',
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-14 h-14 text-base font-bold',
        xl: 'w-20 h-20 text-xl font-bold',
    }[size] || 'w-10 h-10 text-sm';

    // Color gradient based on initial letter for consistency
    const getInitialGradient = (char) => {
        const code = char.charCodeAt(0) % 6;
        const colors = [
            'from-blue-600 to-indigo-600 text-white border-blue-400/40',
            'from-emerald-600 to-teal-600 text-white border-emerald-400/40',
            'from-purple-600 to-indigo-600 text-white border-purple-400/40',
            'from-amber-600 to-orange-600 text-white border-amber-400/40',
            'from-rose-600 to-pink-600 text-white border-rose-400/40',
            'from-cyan-600 to-blue-600 text-white border-cyan-400/40',
        ];
        return colors[code];
    };

    const isClickable = canExpand && !imageError && avatarUrl;

    return (
        <>
            <div
                className={`relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden select-none ${sizeClasses} ${className} ${
                    isClickable ? 'cursor-pointer group' : ''
                }`}
                onClick={(e) => {
                    if (isClickable) {
                        e.stopPropagation();
                        e.preventDefault();
                        setIsLightboxOpen(true);
                    }
                }}
                title={isClickable ? `Click to expand ${targetName}'s photo` : targetName}
            >
                {avatarUrl && !imageError ? (
                    <>
                        <img
                            src={avatarUrl}
                            alt={targetName}
                            className="w-full h-full object-cover rounded-xl transition duration-200 group-hover:scale-105"
                            onError={() => setImageError(true)}
                        />
                        {isClickable && (
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                                <Maximize2 className="w-3.5 h-3.5 text-white drop-shadow-md" />
                            </div>
                        )}
                    </>
                ) : (
                    <div
                        className={`w-full h-full bg-gradient-to-tr ${getInitialGradient(
                            initial
                        )} flex items-center justify-center font-black shadow-2xs border rounded-xl`}
                    >
                        <span>{initial}</span>
                    </div>
                )}
            </div>

            {/* Lightbox / Expand Modal */}
            {isLightboxOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsLightboxOpen(false);
                    }}
                >
                    <div
                        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-700/50 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs text-white">
                                    {initial}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white tracking-wide">
                                        {targetName}
                                    </h4>
                                    {(designation || role) && (
                                        <p className="text-[11px] text-blue-300">
                                            {designation || role}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsLightboxOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                                title="Close preview"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Image Full Size Container */}
                        <div className="p-6 bg-slate-950 flex items-center justify-center min-h-[300px] max-h-[500px] overflow-hidden">
                            <img
                                src={avatarUrl}
                                alt={targetName}
                                className="max-w-full max-h-[460px] object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
                            />
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 bg-slate-900 text-slate-300 text-xs flex items-center justify-between border-t border-slate-800">
                            <span className="text-[11px] text-slate-400">
                                Official Profile Photo &bull; Verified Specialist
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsLightboxOpen(false)}
                                className="px-3.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

