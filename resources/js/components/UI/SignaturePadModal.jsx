import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    Eraser,
    Undo2,
    Check,
    X,
    PenTool,
    Palette,
    Sliders,
    Sparkles,
    ShieldCheck,
    FileText,
    Calendar,
    UploadCloud,
    Image as ImageIcon,
    ArrowLeft,
    ArrowRight,
    AlertCircle,
    CheckCircle2,
} from 'lucide-react';
import { useSignatureSettings } from '../../utils/signatureController';

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

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_IMG_BYTES = 5 * 1024 * 1024;

export const SignaturePadModal = ({
    isOpen,
    onClose,
    onSave,
    initialDataUrl = null,
    initialMeta = null,
    title = 'Official Specimen Signature Studio',
    description = 'Select your digital signature type, then draw freely or attach your official e-signature.',
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const pdfInputRef = useRef(null);
    const imgInputRef = useRef(null);
    const { isPnpkiEnabled: isPnpkiSystemEnabled } = useSignatureSettings();

    const [step, setStep] = useState('choose_type');

    const [signatureType, setSignatureType] = useState(() => (isPnpkiSystemEnabled ? 'pnpki' : 'optional'));

    const [captureMethod, setCaptureMethod] = useState('drawn');

    const [expirationDate, setExpirationDate] = useState('');
    const [pnpkiProofFile, setPnpkiProofFile] = useState(null);
    const [existingProofName, setExistingProofName] = useState('');
    const [existingProofUrl, setExistingProofUrl] = useState('');

    const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState(null);
    const [uploadedImageName, setUploadedImageName] = useState('');

    const [validationError, setValidationError] = useState('');

    const [isDrawing, setIsDrawing] = useState(false);
    const [hasStrokes, setHasStrokes] = useState(false);
    const [strokeColor, setStrokeColor] = useState('#0f172a');
    const [strokeWidth, setStrokeWidth] = useState(2.8);
    const [history, setHistory] = useState([]);

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

    useEffect(() => {
        if (isOpen) {
            setValidationError('');
            if (initialMeta && initialMeta.signatureType) {
                const initExp = initialMeta.expirationDate || '';
                const isExpiredNow = Boolean(
                    initExp && new Date(`${String(initExp).slice(0, 10)}T23:59:59`) < new Date()
                );

                setSignatureType(!isPnpkiSystemEnabled || isExpiredNow ? 'optional' : initialMeta.signatureType);
                setExpirationDate(initExp);
                setPnpkiProofFile(initialMeta.pnpkiProofFile || null);
                setExistingProofName(initialMeta.existingProofName || '');
                setExistingProofUrl(initialMeta.existingProofUrl || '');
                setCaptureMethod(initialMeta.captureMethod || 'drawn');
                if (initialMeta.captureMethod === 'uploaded' && initialDataUrl) {
                    setUploadedImageDataUrl(initialDataUrl);
                }
                setStep('choose_type');
            } else {
                setSignatureType(isPnpkiSystemEnabled ? 'pnpki' : 'optional');
                setStep('choose_type');
                setCaptureMethod('drawn');
                if (initialDataUrl) {
                    setUploadedImageDataUrl(initialDataUrl);
                }
            }
        } else {
            setHistory([]);
            setHasStrokes(false);
            setValidationError('');
        }
    }, [isOpen, initialMeta, initialDataUrl, isPnpkiSystemEnabled]);

    useEffect(() => {
        if (!isPnpkiSystemEnabled && signatureType === 'pnpki') {
            setSignatureType('optional');
        }
    }, [isPnpkiSystemEnabled, signatureType]);

    const saveStateToHistory = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const data = canvas.toDataURL();
        setHistory((prev) => {
            const next = [...prev, data];
            if (next.length > 15) next.shift();
            return next;
        });
    }, []);

    const setupCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const targetWidth = Math.max(rect.width, 260);
        const targetHeight = Math.max(rect.height, 175);

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
        } else if (initialDataUrl && !hasStrokes && captureMethod === 'drawn') {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                setHasStrokes(true);
                saveStateToHistory();
            };
            img.src = initialDataUrl;
        }
    }, [hasStrokes, initialDataUrl, captureMethod, saveStateToHistory]);

    useEffect(() => {
        if (isOpen && step === 'configure' && captureMethod === 'drawn') {
            const timer = setTimeout(() => {
                setupCanvas();
                saveStateToHistory();
            }, 60);

            const handleResize = () => {
                setupCanvas();
            };

            window.addEventListener('resize', handleResize);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('resize', handleResize);
            };
        }
    }, [isOpen, step, captureMethod, setupCanvas, saveStateToHistory]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const touch =
            e.touches && e.touches.length > 0
                ? e.touches[0]
                : e.changedTouches && e.changedTouches.length > 0
                ? e.changedTouches[0]
                : null;
        const clientX = touch ? touch.clientX : e.clientX;
        const clientY = touch ? touch.clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
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
        setValidationError('');

        const color = strokeColorRef.current;
        const width = strokeWidthRef.current;

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;

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

    useEffect(() => {
        if (!isOpen || step !== 'configure' || captureMethod !== 'drawn') return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onTouchStart = (e) => startDrawing(e);
        const onTouchMove = (e) => draw(e);
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
    }, [isOpen, step, captureMethod]);

    const handleClear = () => {
        if (captureMethod === 'uploaded') {
            setUploadedImageDataUrl(null);
            setUploadedImageName('');
            if (imgInputRef.current) imgInputRef.current.value = '';
            return;
        }
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
        newHistory.pop();
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

    const handlePnpkiPdfChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            setValidationError('Only official PDF files (.pdf) are allowed for the PNPKI Proof of Registration.');
            if (pdfInputRef.current) pdfInputRef.current.value = '';
            return;
        }

        if (file.size > MAX_PDF_BYTES) {
            setValidationError(
                `PNPKI Proof PDF exceeds the 5MB maximum limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please attach a PDF up to 5MB.`
            );
            if (pdfInputRef.current) pdfInputRef.current.value = '';
            return;
        }

        setValidationError('');
        setPnpkiProofFile(file);
    };

    const handleSignatureImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setValidationError('Please select a valid image file (PNG, JPG, or WebP) for your e-signature.');
            if (imgInputRef.current) imgInputRef.current.value = '';
            return;
        }

        if (file.size > MAX_IMG_BYTES) {
            setValidationError('Signature image exceeds the 5MB maximum file size.');
            if (imgInputRef.current) imgInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setUploadedImageDataUrl(reader.result);
            setUploadedImageName(file.name);
            setValidationError('');
        };
        reader.readAsDataURL(file);
    };

    const handleChooseOption = (chosenType) => {
        setSignatureType(chosenType);
        setValidationError('');
        setStep('configure');
    };

    const handleApply = () => {
        setValidationError('');

        const initExp = initialMeta?.expirationDate || '';
        const wasPreviouslyExpired = Boolean(
            initExp && new Date(`${String(initExp).slice(0, 10)}T23:59:59`) < new Date()
        );

        if (signatureType === 'pnpki') {
            if (!expirationDate) {
                setValidationError('Please select the expiration date of your PNPKI digital e-signature.');
                return;
            }
            const isSelectedDateExpired = new Date(`${String(expirationDate).slice(0, 10)}T23:59:59`) < new Date();
            if (isSelectedDateExpired) {
                setValidationError(
                    'Your PNPKI expiration date has passed. Please select a new future expiration date and attach your renewed Proof of Registration PDF, or use the Optional Digital Signature.'
                );
                return;
            }
            if (wasPreviouslyExpired && !pnpkiProofFile) {
                setValidationError(
                    'To renew an expired PNPKI signature, please attach your new Proof of Registration PDF (max 5MB).'
                );
                return;
            }
            if (!pnpkiProofFile && !existingProofName && !existingProofUrl) {
                setValidationError('Please attach the PDF file (maximum 5MB) as Proof of Registration of PNPKI.');
                return;
            }
        }

        let finalDataUrl = null;
        if (captureMethod === 'uploaded') {
            if (!uploadedImageDataUrl) {
                setValidationError('Please attach/upload an image of your digital e-signature, or switch to Draw Signature.');
                return;
            }
            finalDataUrl = uploadedImageDataUrl;
        } else {
            const canvas = canvasRef.current;
            if (!canvas || !hasStrokes) {
                setValidationError('Please draw your signature inside the canvas, or switch to Attach Image of E-Sig.');
                return;
            }
            finalDataUrl = canvas.toDataURL('image/png');
        }

        const meta = {
            signatureType,
            expirationDate: signatureType === 'pnpki' ? expirationDate : (expirationDate || initExp),
            pnpkiProofFile: signatureType === 'pnpki' ? pnpkiProofFile : null,
            existingProofName:
                signatureType === 'pnpki'
                    ? pnpkiProofFile?.name || existingProofName
                    : existingProofName || initialMeta?.existingProofName || '',
            existingProofUrl: existingProofUrl || initialMeta?.existingProofUrl || '',
            captureMethod,
        };

        onSave(finalDataUrl, meta);
        onClose();
    };

    if (!isOpen) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const hasProofAttached = Boolean(pnpkiProofFile || existingProofName || existingProofUrl);
    const hasSignatureCaptured = captureMethod === 'drawn' ? hasStrokes : Boolean(uploadedImageDataUrl);
    const isReadyToApply =
        hasSignatureCaptured &&
        (signatureType === 'optional' || (Boolean(expirationDate) && hasProofAttached));

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in-up"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-2xl flex flex-col overflow-hidden max-h-[94vh] sm:max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >

                <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between gap-3 border-b border-blue-900/40 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner ${
                                step === 'configure' && signatureType === 'pnpki'
                                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                    : 'bg-blue-600/25 border-blue-400/35 text-blue-300'
                            }`}
                        >
                            {step === 'configure' && signatureType === 'pnpki' ? (
                                <ShieldCheck className="w-5 h-5" />
                            ) : (
                                <PenTool className="w-5 h-5" />
                            )}
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white truncate">
                                    {title}
                                </h3>
                                {step === 'choose_type' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 whitespace-nowrap">
                                        Step 1 of 2
                                    </span>
                                ) : signatureType === 'pnpki' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 whitespace-nowrap">
                                        <ShieldCheck className="w-3 h-3 shrink-0" />
                                        PNPKI Digital E-Signature
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30 whitespace-nowrap">
                                        <PenTool className="w-3 h-3 shrink-0" />
                                        Optional Digital Signature
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-300 leading-snug mt-0.5 line-clamp-1 sm:line-clamp-none">
                                {step === 'choose_type'
                                    ? 'Select your official digital signature type to continue.'
                                    : signatureType === 'pnpki'
                                    ? 'Set PNPKI expiration date, attach Proof of Registration PDF (max 5MB), then draw or attach e-signature.'
                                    : description}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {step === 'configure' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setValidationError('');
                                    setStep('choose_type');
                                }}
                                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 hover:bg-white/20 text-slate-100 border border-white/15 transition cursor-pointer whitespace-nowrap"
                                title="Return to signature type selection"
                            >
                                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                                <span>Change Option</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                            title="Close studio"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {step === 'choose_type' ? (
                    <div className="p-4 sm:p-6 bg-slate-50 flex-1 overflow-y-auto space-y-5">
                        <div className="text-center max-w-lg mx-auto space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black uppercase tracking-wider">
                                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                Official E-Signature Selection
                            </span>
                            <h4 className="text-sm sm:text-base font-black text-slate-900 pt-1">
                                Choose Your Digital Signature Method
                            </h4>
                            <p className="text-xs text-slate-500">
                                Select an option below to configure your official procurement specimen signature.
                            </p>
                        </div>

                        {isPnpkiSystemEnabled &&
                            initialMeta?.expirationDate &&
                            new Date(`${String(initialMeta.expirationDate).slice(0, 10)}T23:59:59`) < new Date() && (
                                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="space-y-0.5">
                                        <div className="font-extrabold text-rose-800 flex items-center gap-1.5">
                                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                            <span>
                                                PNPKI Certificate Expired ({initialMeta.expirationDate}) — Forced to Optional Digital Signature
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-rose-700">
                                            Your old expiration date and proof of registration remain stored on file. Select{' '}
                                            <strong>Use PNPKI Digital E-Signature</strong> below to renew, or continue with{' '}
                                            <strong>Optional Digital Signature</strong>.
                                        </p>
                                    </div>
                                </div>
                            )}

                        <div className={`grid grid-cols-1 ${isPnpkiSystemEnabled ? 'sm:grid-cols-2' : 'max-w-md mx-auto'} gap-3.5 sm:gap-4`}>

                            {isPnpkiSystemEnabled && (
                                <button
                                    type="button"
                                    onClick={() => handleChooseOption('pnpki')}
                                    className={`group relative text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between bg-white hover:shadow-xl hover:-translate-y-0.5 ${
                                        signatureType === 'pnpki'
                                            ? 'border-emerald-500 ring-2 ring-emerald-500/15'
                                            : 'border-slate-200 hover:border-emerald-400'
                                    }`}
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                                                <ShieldCheck className="w-5 h-5" />
                                            </div>
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                DICT Certified
                                            </span>
                                        </div>

                                        <div>
                                            <h5 className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                                                Use PNPKI Digital E-Signature
                                            </h5>
                                            <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                                                Philippine National Public Key Infrastructure (PNPKI) digital certificate with validity tracking and registration proof.
                                            </p>
                                        </div>

                                        <ul className="space-y-1.5 pt-1 text-[11px] text-slate-600">
                                            <li className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                <span>Select expiration date of using the e-sig</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                <span>Attach PDF proof of PNPKI registration (max 5MB)</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <PenTool className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                <span>Draw signature or attach image of e-sig</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-extrabold text-emerald-700 group-hover:text-emerald-800">
                                        <span>Continue with PNPKI E-Sig</span>
                                        <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => handleChooseOption('optional')}
                                className={`group relative text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between bg-white hover:shadow-xl hover:-translate-y-0.5 ${
                                    signatureType === 'optional'
                                        ? 'border-blue-500 ring-2 ring-blue-500/15'
                                        : 'border-slate-200 hover:border-blue-400'
                                }`}
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
                                            <PenTool className="w-5 h-5" />
                                        </div>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-300">
                                            Standard E-Sig
                                        </span>
                                    </div>

                                    <div>
                                        <h5 className="text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                                            Optional Digital Signature
                                        </h5>
                                        <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                                            Standard official digital specimen signature for document endorsements, PPMPs, and procurement workflows.
                                        </p>
                                    </div>

                                    <ul className="space-y-1.5 pt-1 text-[11px] text-slate-600">
                                        <li className="flex items-center gap-2">
                                            <PenTool className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                            <span>Draw digital signature freely on canvas</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                            <span>Or attach/upload image of digital signature</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                            <span>No PNPKI certificate expiration required</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-extrabold text-blue-700 group-hover:text-blue-800">
                                    <span>Continue with Optional E-Sig</span>
                                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>
                        </div>

                        <div className="flex items-center justify-end pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-200/70 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (

                    <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50/60">

                        {validationError && (
                            <div className="mx-4 mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center justify-between gap-2 shrink-0">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>{validationError}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setValidationError('')}
                                    className="text-rose-400 hover:text-rose-700 cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {signatureType === 'pnpki' && (
                            <div className="px-4 py-3 bg-gradient-to-b from-emerald-50/90 to-emerald-50/40 border-b border-emerald-200/80 space-y-2.5 shrink-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-950 uppercase tracking-wider">
                                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span>PNPKI Digital Certificate Details</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                expirationDate
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    : 'bg-white text-slate-500 border-slate-200'
                                            }`}
                                        >
                                            <Check className="w-2.5 h-2.5" />
                                            1. Expiry Date
                                        </span>
                                        <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                hasProofAttached
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    : 'bg-white text-slate-500 border-slate-200'
                                            }`}
                                        >
                                            <Check className="w-2.5 h-2.5" />
                                            2. Proof PDF
                                        </span>
                                        <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                hasSignatureCaptured
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    : 'bg-white text-slate-500 border-slate-200'
                                            }`}
                                        >
                                            <Check className="w-2.5 h-2.5" />
                                            3. E-Signature
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">

                                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-emerald-200/90 shadow-2xs flex flex-col justify-between">
                                        <div>
                                            <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                                                Expiration Date of Using E-Sig <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <Calendar className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                <input
                                                    type="date"
                                                    min={todayStr}
                                                    value={expirationDate}
                                                    onChange={(e) => {
                                                        setExpirationDate(e.target.value);
                                                        setValidationError('');
                                                    }}
                                                    className="w-full h-9 pl-9 pr-3 text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                                            Select the validity / expiration date of your PNPKI certificate.
                                        </p>
                                    </div>

                                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-emerald-200/90 shadow-2xs flex flex-col justify-between">
                                        <div>
                                            <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                                                Proof of Registration of PNPKI (PDF) <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                ref={pdfInputRef}
                                                type="file"
                                                accept=".pdf,application/pdf"
                                                onChange={handlePnpkiPdfChange}
                                                className="hidden"
                                            />

                                            {pnpkiProofFile ? (
                                                <div className="h-9 px-2.5 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                                                        <div className="min-w-0 leading-tight">
                                                            <div className="text-[11px] font-bold text-emerald-950 truncate">
                                                                {pnpkiProofFile.name}
                                                            </div>
                                                            <div className="text-[9.5px] text-emerald-700">
                                                                {(pnpkiProofFile.size / (1024 * 1024)).toFixed(2)} MB &bull; PDF Verified
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => pdfInputRef.current?.click()}
                                                        className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded shrink-0 cursor-pointer"
                                                    >
                                                        Replace
                                                    </button>
                                                </div>
                                            ) : existingProofName || existingProofUrl ? (
                                                <div className="h-9 px-2.5 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                                                        <div className="min-w-0 leading-tight">
                                                            <div className="text-[11px] font-bold text-emerald-950 truncate">
                                                                {existingProofName || 'PNPKI_Proof_of_Registration.pdf'}
                                                            </div>
                                                            {existingProofUrl && (
                                                                <a
                                                                    href={existingProofUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[9.5px] text-emerald-700 underline font-semibold block"
                                                                >
                                                                    View current PDF
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => pdfInputRef.current?.click()}
                                                        className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded shrink-0 cursor-pointer"
                                                    >
                                                        Replace
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => pdfInputRef.current?.click()}
                                                    className="w-full h-9 px-3 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 rounded-lg flex items-center justify-center gap-2 text-xs font-bold text-emerald-800 transition cursor-pointer"
                                                >
                                                    <UploadCloud className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span className="truncate">Attach PNPKI Proof PDF (Max 5MB)</span>
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                                            Official PDF certificate / registration proof only (max 5MB).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">

                            <div className="grid grid-cols-2 sm:inline-flex p-1 bg-slate-100 border border-slate-200/80 rounded-xl w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCaptureMethod('drawn');
                                        setValidationError('');
                                    }}
                                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                                        captureMethod === 'drawn'
                                            ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <PenTool className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>Draw Signature</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCaptureMethod('uploaded');
                                        setValidationError('');
                                    }}
                                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                                        captureMethod === 'uploaded'
                                            ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>Attach Image of E-Sig</span>
                                </button>
                            </div>

                            {captureMethod === 'drawn' && (
                                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-wrap">

                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                            <Palette className="w-3.5 h-3.5 text-blue-600" />
                                            <span className="hidden md:inline">Ink:</span>
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {INK_COLORS.map((c) => (
                                                <button
                                                    key={c.value}
                                                    type="button"
                                                    onClick={() => setStrokeColor(c.value)}
                                                    title={c.label}
                                                    className={`w-5 h-5 rounded-full transition-transform cursor-pointer border-2 ${
                                                        strokeColor === c.value
                                                            ? 'scale-110 border-blue-500 ring-2 ring-blue-400/30'
                                                            : 'border-white hover:scale-105'
                                                    } ${c.bg}`}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:flex items-center gap-1">
                                            <Sliders className="w-3 h-3 text-slate-500" />
                                            <span>Size:</span>
                                        </span>
                                        <div className="inline-flex p-0.5 bg-slate-100 border border-slate-200/80 rounded-lg">
                                            {PEN_SIZES.map((sz) => (
                                                <button
                                                    key={sz.value}
                                                    type="button"
                                                    onClick={() => setStrokeWidth(sz.value)}
                                                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                                        strokeWidth === sz.value
                                                            ? 'bg-white text-slate-900 shadow-2xs'
                                                            : 'text-slate-600 hover:text-slate-900'
                                                    }`}
                                                >
                                                    {sz.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={handleUndo}
                                            disabled={history.length <= 1}
                                            className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                            title="Undo stroke"
                                        >
                                            <Undo2 className="w-3.5 h-3.5" />
                                            <span>Undo</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleClear}
                                            disabled={!hasStrokes}
                                            className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                            title="Clear canvas"
                                        >
                                            <Eraser className="w-3.5 h-3.5" />
                                            <span>Clear</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-3.5 sm:p-4 bg-slate-100/90 flex-1 flex flex-col justify-center items-center">
                            {captureMethod === 'drawn' ? (
                                <>
                                    <div
                                        ref={containerRef}
                                        className={`relative w-full bg-white rounded-xl border-2 border-dashed border-slate-300 shadow-inner overflow-hidden cursor-crosshair group touch-none select-none transition-colors hover:border-blue-400 ${
                                            signatureType === 'pnpki'
                                                ? 'h-[185px] sm:h-[210px]'
                                                : 'h-[220px] sm:h-[260px]'
                                        }`}
                                    >
                                        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-5 opacity-35 select-none">
                                            <div className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
                                                {signatureType === 'pnpki'
                                                    ? 'PNPKI Official Digital E-Signature Specimen Space'
                                                    : 'Official Specimen Authentication Space'}
                                            </div>
                                            <div className="border-b-2 border-dashed border-blue-300 w-full mb-2 flex items-center justify-between">
                                                <span className="text-[10px] text-blue-500 font-semibold tracking-wider uppercase mb-1">
                                                    Sign on / above baseline
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono mb-1">
                                                    OPPMO E-Procurement
                                                </span>
                                            </div>
                                        </div>

                                        <canvas
                                            ref={canvasRef}
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseLeave={stopDrawing}
                                            style={{ touchAction: 'none' }}
                                            className="absolute inset-0 w-full h-full block bg-transparent touch-none cursor-crosshair"
                                        />

                                        {!hasStrokes && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 select-none px-4 text-center">
                                                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-1.5 shadow-2xs">
                                                    <PenTool className="w-5 h-5 stroke-[1.5]" />
                                                </div>
                                                <span className="text-xs sm:text-sm font-bold text-slate-600">
                                                    Draw your digital signature freely inside this canvas
                                                </span>
                                                <span className="text-[11px] text-slate-400 mt-0.5">
                                                    Or click &ldquo;Attach Image of E-Sig&rdquo; above to upload an image file
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between w-full mt-2 px-1 text-[10px] sm:text-[11px] text-slate-500">
                                        <span className="flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            <span>Smooth curve capture with high-DPI antialiasing</span>
                                        </span>
                                        <span className="hidden sm:inline">Press and drag to sign</span>
                                    </div>
                                </>
                            ) : (

                                <div
                                    className={`w-full bg-white rounded-xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 shadow-inner p-4 flex flex-col items-center justify-center relative transition ${
                                        signatureType === 'pnpki'
                                            ? 'h-[185px] sm:h-[210px]'
                                            : 'h-[220px] sm:h-[260px]'
                                    }`}
                                >
                                    <input
                                        ref={imgInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={handleSignatureImageUpload}
                                        className="hidden"
                                    />

                                    {uploadedImageDataUrl ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2.5">
                                            <div className="flex-1 flex items-center justify-center max-h-[130px] p-2 bg-slate-50/70 rounded-xl border border-slate-200/80 w-full">
                                                <img
                                                    src={uploadedImageDataUrl}
                                                    alt="Attached E-Signature Preview"
                                                    className="max-h-[115px] max-w-full object-contain filter contrast-125 drop-shadow-sm"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap justify-center">
                                                {uploadedImageName && (
                                                    <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[200px]">
                                                        {uploadedImageName}
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => imgInputRef.current?.click()}
                                                    className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer transition"
                                                >
                                                    Replace Image
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleClear}
                                                    className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => imgInputRef.current?.click()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    imgInputRef.current?.click();
                                                }
                                            }}
                                            className="w-full h-full flex flex-col items-center justify-center text-center cursor-pointer p-3 group"
                                        >
                                            <div className="w-11 h-11 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-2 shadow-2xs transition-transform group-hover:scale-105">
                                                <UploadCloud className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-indigo-700">
                                                Click to attach an image of your Digital E-Signature
                                            </span>
                                            <span className="text-[11px] text-slate-400 mt-0.5">
                                                Supports transparent PNG, JPG, or WebP image files (up to 5MB)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="px-4 sm:px-5 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setValidationError('');
                                    setStep('choose_type');
                                }}
                                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                                <span>Back to Options</span>
                            </button>

                            <div className="flex items-center gap-2 ml-auto">
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApply}
                                    disabled={!isReadyToApply}
                                    className={`inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer focus:outline-none focus:ring-2 whitespace-nowrap ${
                                        signatureType === 'pnpki'
                                            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 focus:ring-emerald-500'
                                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 focus:ring-blue-500'
                                    }`}
                                >
                                    <Check className="w-4 h-4 shrink-0" />
                                    <span>
                                        {signatureType === 'pnpki' ? 'Apply PNPKI Signature' : 'Apply Optional Signature'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SignaturePadModal;
