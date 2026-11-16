import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
    Maximize2, 
    Eraser, 
    Undo2, 
    Check, 
    X, 
    PenTool, 
    Palette,
    Sliders,
    Sparkles,
    RotateCcw
} from 'lucide-react';

const INK_COLORS = [
    { label: 'Deep Slate / Ink Black', value: '#0f172a', bg: 'bg-slate-900' },
    { label: 'Executive Navy Blue', value: '#1e3a8a', bg: 'bg-blue-900' },
    { label: 'Royal Blue', value: '#2563eb', bg: 'bg-blue-600' },
    { label: 'Official Emerald', value: '#065f46', bg: 'bg-emerald-800' },
];

const PEN_SIZES = [
    { label: 'Fine', value: 1.8 },
    { label: 'Standard', value: 2.8 },
    { label: 'Bold', value: 4.2 },
];

export const SignaturePadModal = ({
    isOpen,
    onClose,
    onSave,
    initialDataUrl = null,
    title = 'Draw Specimen Official Signature',
    description = 'Sign smoothly and freely using your cursor, mouse, or touch stylus. Works in ultra high resolution.'
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [hasStrokes, setHasStrokes] = useState(false);
    const [strokeColor, setStrokeColor] = useState('#0f172a');
    const [strokeWidth, setStrokeWidth] = useState(2.8);
    const [history, setHistory] = useState([]);

    // Keep track of current stroke points for smooth bezier interpolation
    const currentPointsRef = useRef([]);
    const isDrawingRef = useRef(false);
    const strokeColorRef = useRef(strokeColor);
    const strokeWidthRef = useRef(strokeWidth);

    useEffect(() => {
        strokeColorRef.current = strokeColor;
    }, [strokeColor]);

    useEffect(() => {
        strokeWidthRef.current = strokeWidth;
    }, [strokeWidth]);

    // Initialize canvas sizing with devicePixelRatio for ultra sharp strokes
    const setupCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const targetWidth = Math.max(rect.width, 300);
        const targetHeight = Math.max(rect.height, 220);

        // Save current canvas content if any
        let tempImg = null;
        if (canvas.width > 0 && canvas.height > 0 && hasStrokes) {
            tempImg = canvas.toDataURL();
        }

        canvas.width = targetWidth * dpr;
        canvas.height = targetHeight * dpr;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (tempImg) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            };
            img.src = tempImg;
        } else if (initialDataUrl && !hasStrokes) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                setHasStrokes(true);
                saveStateToHistory();
            };
            img.src = initialDataUrl;
        }
    }, [hasStrokes, initialDataUrl]);

    useEffect(() => {
        if (isOpen) {
            // Small timeout to allow container geometry to settle
            const timer = setTimeout(() => {
                setupCanvas();
                saveStateToHistory();
            }, 60);

            const handleResize = () => {
                // Keep strokes intact on window resize
                setupCanvas();
            };

            window.addEventListener('resize', handleResize);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('resize', handleResize);
            };
        } else {
            setHistory([]);
            setHasStrokes(false);
        }
    }, [isOpen]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches && e.touches.length > 0 ? e.touches[0] : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0] : null);
        const clientX = touch ? touch.clientX : e.clientX;
        const clientY = touch ? touch.clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    };

    const saveStateToHistory = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const data = canvas.toDataURL();
        setHistory((prev) => {
            // Cap history to 15 entries for performance
            const next = [...prev, data];
            if (next.length > 15) next.shift();
            return next;
        });
    };

    const startDrawing = (e) => {
        if (e && e.cancelable) {
            e.preventDefault();
        }
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const coords = getCoordinates(e);

        currentPointsRef.current = [coords];
        isDrawingRef.current = true;
        setIsDrawing(true);

        const color = strokeColorRef.current;
        const width = strokeWidthRef.current;

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;

        // Draw an initial point dot for tap/click
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, width / 2, 0, Math.PI * 2);
        ctx.fill();
        setHasStrokes(true);
    };

    const draw = (e) => {
        if (!isDrawingRef.current) return;
        if (e && e.cancelable) {
            e.preventDefault();
        }
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const coords = getCoordinates(e);

        const points = currentPointsRef.current;
        points.push(coords);

        const color = strokeColorRef.current;
        const width = strokeWidthRef.current;

        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Smooth curved lines with quadratic bezier curve interpolation
        if (points.length >= 3) {
            const p1 = points[points.length - 3];
            const p2 = points[points.length - 2];
            const p3 = points[points.length - 1];

            const mid1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const mid2 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };

            ctx.beginPath();
            ctx.moveTo(mid1.x, mid1.y);
            ctx.quadraticCurveTo(p2.x, p2.y, mid2.x, mid2.y);
            ctx.stroke();
        } else if (points.length === 2) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.stroke();
        }

        setHasStrokes(true);
    };

    const stopDrawing = () => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        setIsDrawing(false);
        currentPointsRef.current = [];
        saveStateToHistory();
    };

    // Attach non-passive native touch event listeners so touch drawing on mobile/tablets
    // doesn't scroll the screen and prevents "Unable to preventDefault inside passive event listener"
    useEffect(() => {
        if (!isOpen) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onTouchStart = (e) => {
            startDrawing(e);
        };
        const onTouchMove = (e) => {
            draw(e);
        };
        const onTouchEnd = (e) => {
            if (e && e.cancelable) e.preventDefault();
            stopDrawing();
        };

        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

        return () => {
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
            canvas.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [isOpen]);

    const handleClear = () => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const ctx = canvas.getContext('2d');
        const rect = container.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        setHasStrokes(false);
        saveStateToHistory();
    };

    const handleUndo = () => {
        if (history.length <= 1) {
            handleClear();
            return;
        }
        const newHistory = [...history];
        newHistory.pop(); // Remove current state
        const prevState = newHistory[newHistory.length - 1];
        setHistory(newHistory);

        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const ctx = canvas.getContext('2d');
        const rect = container.getBoundingClientRect();

        ctx.clearRect(0, 0, rect.width, rect.height);

        if (prevState) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, rect.width, rect.height);
                setHasStrokes(true);
            };
            img.src = prevState;
        } else {
            setHasStrokes(false);
        }
    };

    const handleApply = () => {
        const canvas = canvasRef.current;
        if (!canvas || !hasStrokes) {
            onSave(null);
            onClose();
            return;
        }
        // Export crisp high quality PNG
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-fade-in-up">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-2xl flex flex-col overflow-hidden max-h-[95vh]">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between border-b border-blue-900/40 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-300">
                            <PenTool className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                                {title}
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                    Freeform Studio
                                </span>
                            </h3>
                            <p className="text-[11px] text-slate-300 leading-tight">
                                {description}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                        title="Close studio"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Studio Control Toolbar */}
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                    {/* Color selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Palette className="w-3.5 h-3.5 text-blue-600" /> Ink:
                        </span>
                        <div className="flex items-center gap-1.5">
                            {INK_COLORS.map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => setStrokeColor(c.value)}
                                    title={c.label}
                                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer border-2 ${
                                        strokeColor === c.value
                                            ? 'scale-110 border-blue-500 ring-2 ring-blue-400/30'
                                            : 'border-white hover:scale-105'
                                    } ${c.bg}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Stroke width */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Sliders className="w-3.5 h-3.5 text-slate-600" /> Thickness:
                        </span>
                        <div className="inline-flex p-0.5 bg-slate-200/80 rounded-lg">
                            {PEN_SIZES.map((sz) => (
                                <button
                                    key={sz.value}
                                    type="button"
                                    onClick={() => setStrokeWidth(sz.value)}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                        strokeWidth === sz.value
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {sz.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quick Tools: Undo & Clear */}
                    <div className="flex items-center gap-1.5 ml-auto">
                        <button
                            type="button"
                            onClick={handleUndo}
                            disabled={history.length <= 1}
                            className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200/80 rounded-lg transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="Undo stroke"
                        >
                            <Undo2 className="w-3.5 h-3.5" />
                            Undo
                        </button>
                        <button
                            type="button"
                            onClick={handleClear}
                            disabled={!hasStrokes}
                            className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="Clear whole signature canvas"
                        >
                            <Eraser className="w-3.5 h-3.5" />
                            Clear
                        </button>
                    </div>
                </div>

                {/* Freeform Signature Drawing Board */}
                <div className="p-4 sm:p-5 bg-slate-100 flex-1 flex flex-col justify-center items-center overflow-hidden">
                    <div
                        ref={containerRef}
                        className="relative w-full h-[260px] sm:h-[320px] bg-white rounded-xl border-2 border-dashed border-slate-300 shadow-inner overflow-hidden cursor-crosshair group touch-none select-none transition-colors hover:border-blue-400"
                    >
                        {/* Subtly patterned signature baseline and watermark */}
                        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 opacity-30 select-none">
                            <div className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
                                Official Specimen Authentication Space
                            </div>
                            <div className="border-b-2 border-dashed border-blue-300 w-full mb-4 flex items-center justify-between">
                                <span className="text-[10px] text-blue-500 font-semibold tracking-wider uppercase mb-1">
                                    Sign on / above baseline
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono mb-1">
                                    OPPMO E-Procurement
                                </span>
                            </div>
                        </div>

                        {/* Interactive Canvas */}
                        <canvas
                            ref={canvasRef}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            style={{ touchAction: 'none' }}
                            className="absolute inset-0 w-full h-full block bg-transparent touch-none cursor-crosshair"
                        />

                        {/* Guidance overlay when empty */}
                        {!hasStrokes && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 select-none">
                                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-2 shadow-sm animate-pulse">
                                    <PenTool className="w-6 h-6 stroke-[1.5]" />
                                </div>
                                <span className="text-sm font-bold text-slate-600">
                                    Draw freely anywhere inside this canvas
                                </span>
                                <span className="text-xs text-slate-400 mt-0.5">
                                    Smooth bezier curves enabled for mouse, touchpads, or touch screens
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center justify-between w-full mt-2 px-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Hardware accelerated smooth curve capture with antialiasing
                        </span>
                        <span>Press and drag freely</span>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleClear}
                            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={!hasStrokes}
                            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <Check className="w-4 h-4" />
                            Apply Signature
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignaturePadModal;
