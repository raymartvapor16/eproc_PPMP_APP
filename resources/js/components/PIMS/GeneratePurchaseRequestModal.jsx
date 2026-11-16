import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    X,
    FileCheck2,
    Sparkles,
    Building2,
    Calendar,
    Paperclip,
    Plus,
    Trash2,
    FileText,
    Printer,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ShieldCheck,
    Coins,
    Upload,
    Link as LinkIcon,
    Lock,
    ExternalLink,
} from 'lucide-react';
import { pimsService, ppmpService } from '../../services/api';
import { formatCurrency } from '../UI/StatusBadge';

export const GeneratePurchaseRequestModal = ({
    isOpen,
    onClose,
    ppmpUuid = null,
    monitoringProjectId = null,
    onSuccess,
}) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [fetchedData, setFetchedData] = useState(null);

    // Multiple PDF Attachments state (PDF only, max 10MB per file)
    const [pdfFiles, setPdfFiles] = useState([]);
    const fileInputRef = useRef(null);

    // Secure External Links state (HTTPS only)
    const [secureLinks, setSecureLinks] = useState([]);
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [newLinkTitle, setNewLinkTitle] = useState('');
    const [linkError, setLinkError] = useState('');

    const [formData, setFormData] = useState({
        tracker_id: '',
        pr_number: '',
        date_published: new Date().toISOString().split('T')[0],
        pr_date: new Date().toISOString().split('T')[0],
        department: '',
        section: '',
        source: 'PPMP',
        category: 'GOODS_CONSULTING',
        procurement_mode: 'SVP',
        purpose: '',
        place_of_delivery: 'PGSO Warehouse/On Site',
        delivery_period: 'Date of activity',
        payment_method: 'One-Time Payment/ Credit Basis',
        charges: '',
        green_specifications: '',
        pr_certification_date: '',
        total_cost: 0,
        requested_by_name: '',
        requested_by_designation: '',
        cash_availability_name: 'FARAH GEMMA V. BIDAN, CPA',
        cash_availability_designation: 'Provincial Treasurer',
        approved_by_name: 'HON. YVONNE R. CAGAS',
        approved_by_designation: 'Provincial Governor',
        direct_end_user_name: '',
        direct_end_user_designation: '',
        direct_end_user_signed_at: new Date().toISOString().split('T')[0],
        items: [],
    });

    useEffect(() => {
        if (!isOpen || !ppmpUuid) return;
        let isMounted = true;
        setLoading(true);
        setError('');

        pimsService.getPpmpData(ppmpUuid)
            .then((res) => {
                if (!isMounted) return;
                const data = res.data;
                setFetchedData(data);

                const pre = data.prepopulated || {};
                setFormData({
                    tracker_id: pre.tracker_id || '',
                    pr_number: '',
                    date_published: new Date().toISOString().split('T')[0],
                    pr_date: new Date().toISOString().split('T')[0],
                    department: pre.department || '',
                    section: pre.section || '',
                    source: pre.source || 'PPMP',
                    category: pre.category || 'GOODS_CONSULTING',
                    procurement_mode: pre.procurement_mode || 'SVP',
                    purpose: pre.purpose || '',
                    place_of_delivery: pre.place_of_delivery || 'PGSO Warehouse/On Site',
                    delivery_period: pre.delivery_period || 'Date of activity',
                    payment_method: pre.payment_method || 'One-Time Payment/ Credit Basis',
                    charges: pre.charges || '',
                    green_specifications: pre.green_specifications || '',
                    pr_certification_date: '',
                    total_cost: pre.total_cost || 0,
                    requested_by_name: pre.requested_by_name || '',
                    requested_by_designation: pre.requested_by_designation || '',
                    cash_availability_name: pre.cash_availability_name || 'FARAH GEMMA V. BIDAN, CPA',
                    cash_availability_designation: pre.cash_availability_designation || 'Provincial Treasurer',
                    approved_by_name: pre.approved_by_name || 'HON. YVONNE R. CAGAS',
                    approved_by_designation: pre.approved_by_designation || 'Provincial Governor',
                    direct_end_user_name: pre.direct_end_user_name || '',
                    direct_end_user_designation: pre.direct_end_user_designation || '',
                    direct_end_user_signed_at: new Date().toISOString().split('T')[0],
                    items: Array.isArray(pre.items) && pre.items.length > 0 ? pre.items : [
                        {
                            item_no: '1',
                            unit: 'lot',
                            item_description: pre.purpose || 'Procurement of Goods/Services',
                            quantity: 1,
                            unit_cost: pre.total_cost || 0,
                            total_cost: pre.total_cost || 0,
                            is_lot_header: false,
                        }
                    ],
                });
            })
            .catch((err) => {
                if (isMounted) {
                    setError(err.response?.data?.message || 'Failed to retrieve procurement details.');
                }
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, ppmpUuid]);

    // Check if the current PPMP's Type of Project to be Procured is INFRASTRUCTURE
    const isInfraProject = useMemo(() => {
        // 1. Direct category flags from backend / monitoring / prepopulated
        if (
            formData.category === 'INFRA' ||
            fetchedData?.prepopulated?.category === 'INFRA' ||
            fetchedData?.prepopulated?.is_infrastructure ||
            fetchedData?.monitoring_project?.category === 'INFRA'
        ) {
            return true;
        }

        const ppmp = fetchedData?.ppmp;
        // 2. Direct project_type or general_description on PPMP
        const directType = String(ppmp?.project_type || ppmp?.general_description || '').toLowerCase();
        if (directType.includes('infra')) return true;

        // 3. Type of the Project to be Procured on PPMP items
        const ppmpItems = ppmp?.items || [];
        if (ppmpItems.some((item) => !item.is_header && String(item.project_type || '').toLowerCase().includes('infra'))) {
            return true;
        }

        // 4. Form items if user modified or prefilled
        const formItems = formData?.items || [];
        if (formItems.some((item) => !item.is_lot_header && String(item.project_type || '').toLowerCase().includes('infra'))) {
            return true;
        }

        // 5. Tracking / tracker ID containing INFRA
        const tracker = String(ppmp?.tracking_number || ppmp?.ppmp_number || formData.tracker_id || '').toLowerCase();
        if (tracker.includes('infra')) return true;

        return false;
    }, [formData.category, formData.tracker_id, formData.items, fetchedData]);

    if (!isOpen) return null;

    // Recalculate total cost from items
    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === 'quantity' || field === 'unit_cost') {
            const qty = parseFloat(newItems[index].quantity) || 0;
            const cost = parseFloat(newItems[index].unit_cost) || 0;
            newItems[index].total_cost = qty * cost;
        }

        const calculatedTotal = newItems.reduce((acc, curr) => acc + (parseFloat(curr.total_cost) || 0), 0);
        setFormData((prev) => ({
            ...prev,
            items: newItems,
            total_cost: calculatedTotal,
        }));
    };

    const handleAddItem = () => {
        const nextNo = (formData.items.length + 1).toString();
        setFormData((prev) => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    item_no: nextNo,
                    unit: 'piece',
                    item_description: '',
                    quantity: 1,
                    unit_cost: 0,
                    total_cost: 0,
                    is_lot_header: false,
                },
            ],
        }));
    };

    const handleRemoveItem = (index) => {
        if (formData.items.length <= 1) return;
        const newItems = formData.items.filter((_, i) => i !== index);
        const calculatedTotal = newItems.reduce((acc, curr) => acc + (parseFloat(curr.total_cost) || 0), 0);
        setFormData((prev) => ({
            ...prev,
            items: newItems,
            total_cost: calculatedTotal,
        }));
    };

    // Handle Multiple PDF Files Selection
    const handlePdfFilesChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        let hasError = false;
        const validFiles = [];

        for (const file of files) {
            // Strict PDF validation: check mime and extension
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (!isPdf) {
                setError(`Validation Error: "${file.name}" is not a PDF. Only PDF files are allowed.`);
                hasError = true;
                break;
            }

            // Max 10MB limit (10 * 1024 * 1024 bytes)
            if (file.size > 10 * 1024 * 1024) {
                setError(`File size error: "${file.name}" exceeds the 10MB maximum limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
                hasError = true;
                break;
            }

            validFiles.push(file);
        }

        if (!hasError && validFiles.length > 0) {
            setError('');
            setPdfFiles((prev) => [...prev, ...validFiles]);
        }

        // Reset file input value so same files can be re-selected if removed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemovePdfFile = (index) => {
        setPdfFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // Handle Secure External Links (HTTPS only)
    const handleAddSecureLink = () => {
        setLinkError('');
        const trimmedUrl = newLinkUrl.trim();
        const trimmedTitle = newLinkTitle.trim();

        if (!trimmedUrl) {
            setLinkError('Please enter a document URL.');
            return;
        }

        // Strict HTTPS security check
        if (!trimmedUrl.toLowerCase().startsWith('https://')) {
            setLinkError('Security requirement: URL must strictly begin with https:// (e.g. https://drive.google.com/...)');
            return;
        }

        try {
            new URL(trimmedUrl);
        } catch {
            setLinkError('Please enter a valid, well-formed HTTPS URL.');
            return;
        }

        setSecureLinks((prev) => [
            ...prev,
            {
                url: trimmedUrl,
                title: trimmedTitle || 'Secure Cloud Document Link',
            },
        ]);

        setNewLinkUrl('');
        setNewLinkTitle('');
    };

    const handleRemoveSecureLink = (index) => {
        setSecureLinks((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.tracker_id.trim()) {
            setError('Tracker ID is required.');
            return;
        }

        if (!formData.department.trim()) {
            setError('Department is required.');
            return;
        }

        if (!formData.purpose.trim()) {
            setError('Purpose / Justification is required.');
            return;
        }

        setSubmitting(true);
        try {
            // Package as FormData to handle multiple PDF files & secure links seamlessly
            const formDataToSend = new FormData();
            formDataToSend.append('ppmp_uuid', ppmpUuid);
            if (monitoringProjectId || fetchedData?.monitoring_project?.id) {
                formDataToSend.append('monitoring_project_id', monitoringProjectId || fetchedData?.monitoring_project?.id);
            }

            // Sanitize items: ensure string item_no and numeric totals
            const sanitizedItems = (formData.items || []).map((it, idx) => ({
                item_no: String(it.item_no || idx + 1),
                unit: it.unit || 'lot',
                item_description: it.item_description || formData.purpose || 'Procurement requirement',
                quantity: parseFloat(it.quantity) || 1,
                unit_cost: parseFloat(it.unit_cost) || 0,
                total_cost: parseFloat(it.total_cost) || 0,
                is_lot_header: Boolean(it.is_lot_header),
            }));
            formDataToSend.append('items', JSON.stringify(sanitizedItems));

            // Append scalar form fields, skipping empty strings so nullable dates/ids aren't rejected
            Object.entries(formData).forEach(([key, val]) => {
                if (key === 'items') {
                    // Handled above
                } else if (key === 'date_published') {
                    formDataToSend.append('date_published', new Date().toISOString().split('T')[0]);
                } else if (val !== null && val !== undefined && val !== '') {
                    formDataToSend.append(key, val);
                }
            });

            // Append multiple PDF attachments (each validated <= 10MB)
            pdfFiles.forEach((file) => {
                formDataToSend.append('pdf_files[]', file);
            });

            // Append secure external links (strictly for Infrastructure projects)
            if (isInfraProject && secureLinks.length > 0) {
                formDataToSend.append('links', JSON.stringify(secureLinks));
            }

            const res = await pimsService.generatePurchaseRequest(formDataToSend);
            const generatedPr = res.data.purchase_request;

            // Update published cache in localStorage
            try {
                const stored = localStorage.getItem('pims_published_ppmps');
                const map = stored ? JSON.parse(stored) : {};
                map[ppmpUuid] = { publishedAt: new Date().toISOString() };
                localStorage.setItem('pims_published_ppmps', JSON.stringify(map));
            } catch (e) {}

            // Notify all listening components across modules
            window.dispatchEvent(new CustomEvent('pims:pr_generated', { detail: generatedPr }));
            window.dispatchEvent(new CustomEvent('pims:published'));
            window.dispatchEvent(new CustomEvent('monitoring:updated'));

            if (onSuccess) {
                onSuccess(generatedPr);
            }
            onClose();
        } catch (err) {
            console.error('Failed to generate PR', err);
            const backendMsg = err.response?.data?.message;
            const backendErrors = err.response?.data?.errors;
            let displayMsg = backendMsg || 'Failed to generate Purchase Request.';
            if (backendErrors && typeof backendErrors === 'object') {
                const errorDetails = Object.values(backendErrors).flat().join('; ');
                if (errorDetails && errorDetails !== backendMsg) {
                    displayMsg = `${backendMsg} (${errorDetails})`;
                }
            }
            setError(displayMsg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                            <FileCheck2 className="w-5 h-5 text-emerald-300" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                                <span>GENERATE PURCHASE REQUEST (PR)</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                                    Official Template
                                </span>
                            </h2>
                            <p className="text-xs text-blue-200">
                                Generated from PPMP/APP detailed specifications &bull; PR ID: {formData.tracker_id || 'Auto'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <p className="text-xs font-semibold">Retrieving procurement details and attachments...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5">
                                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Section 1: Identification & Document Meta */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                                <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    <span>Document Header & Identification</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            PR Id (Tracker No.) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.tracker_id}
                                            onChange={(e) => setFormData({ ...formData, tracker_id: e.target.value })}
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                        <p className="text-[10px] text-slate-500 mt-0.5">Directly copied from PPMP Tracker</p>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Assigned P.R No. <span className="text-slate-400 font-normal">(Optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="To be assigned by Control"
                                            value={formData.pr_number}
                                            onChange={(e) => setFormData({ ...formData, pr_number: e.target.value })}
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-[11px] font-bold text-slate-700">
                                                Date Submitted / Published
                                            </label>
                                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                                Current Date (Locked)
                                            </span>
                                        </div>
                                        <input
                                            type="date"
                                            readOnly
                                            disabled
                                            value={new Date().toISOString().split('T')[0]}
                                            className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-300 rounded-lg text-slate-600 font-semibold cursor-not-allowed select-none focus:outline-none"
                                            title="Date Submitted / Published is locked to current date only."
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Department <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.department}
                                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Section
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Administrative Section"
                                            value={formData.section}
                                            onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Purpose / Justification <span className="text-rose-500">*</span>
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={formData.purpose}
                                        onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Section 2: Items and Description Breakdown */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                        <Coins className="w-4 h-4 text-emerald-600" />
                                        <span>Procurement Items & Detailed Breakdown</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Item Row</span>
                                    </button>
                                </div>

                                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                                    <table className="w-full text-left text-xs divide-y divide-slate-200">
                                        <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                                            <tr>
                                                <th className="px-2.5 py-2 w-16">Item No.</th>
                                                <th className="px-2.5 py-2 w-20">Unit</th>
                                                <th className="px-2.5 py-2">Item and Description</th>
                                                <th className="px-2.5 py-2 w-20 text-right">Qty</th>
                                                <th className="px-2.5 py-2 w-28 text-right">Unit Cost</th>
                                                <th className="px-2.5 py-2 w-32 text-right">Total Cost</th>
                                                <th className="px-2.5 py-2 w-10 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {formData.items.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/70">
                                                    <td className="px-2 py-1.5">
                                                        <input
                                                            type="text"
                                                            value={item.item_no}
                                                            onChange={(e) => handleItemChange(idx, 'item_no', e.target.value)}
                                                            className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded text-center font-medium"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <input
                                                            type="text"
                                                            value={item.unit || ''}
                                                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                                            className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded text-center"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <textarea
                                                            rows={2}
                                                            value={item.item_description}
                                                            onChange={(e) => handleItemChange(idx, 'item_description', e.target.value)}
                                                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded leading-snug"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            value={item.quantity || ''}
                                                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                            className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded text-right"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.unit_cost || ''}
                                                            onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                                                            className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded text-right"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right font-bold text-slate-800">
                                                        {formatCurrency(item.total_cost || 0)}
                                                    </td>
                                                    <td className="px-1 py-1.5 text-center">
                                                        {formData.items.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveItem(idx)}
                                                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                                            <tr>
                                                <td colSpan={5} className="px-3 py-2 text-right uppercase text-xs text-slate-700">
                                                    Estimated Total Cost :
                                                </td>
                                                <td className="px-3 py-2 text-right text-sm text-blue-700">
                                                    {formatCurrency(formData.total_cost)}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Section 3: Delivery Terms & Green Specifications */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                                <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                    Contractual Terms & Technical Specifications
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Place of Delivery
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.place_of_delivery}
                                            onChange={(e) => setFormData({ ...formData, place_of_delivery: e.target.value })}
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Period of Delivery
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.delivery_period}
                                            onChange={(e) => setFormData({ ...formData, delivery_period: e.target.value })}
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Period of Payment
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.payment_method}
                                            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Charges (Account Code & Source of Fund)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.charges}
                                        onChange={(e) => setFormData({ ...formData, charges: e.target.value })}
                                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Green Procurement Technical Specifications & Special Conditions
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={formData.green_specifications}
                                        onChange={(e) => setFormData({ ...formData, green_specifications: e.target.value })}
                                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-sans leading-relaxed"
                                    />
                                </div>
                            </div>

                            {/* Section 4: Attach Multiple PDF Documents (PDF Only, Max 10MB each) */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                        <Paperclip className="w-4 h-4 text-blue-600" />
                                        <span>Attach Multiple PDF Documents</span>
                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                                            PDF Only &bull; Max 10MB each
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>Browse PDF Files</span>
                                    </button>
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handlePdfFilesChange}
                                    multiple
                                    accept=".pdf,application/pdf"
                                    className="hidden"
                                />

                                {/* Upload drop/browse banner */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/40 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
                                >
                                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <FileText className="w-4 h-4 text-red-500" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-700">
                                        Click to attach and upload PDF files
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        Strict security validation: Only genuine PDF documents accepted. Maximum 10MB per file.
                                    </p>
                                </div>

                                {/* List of selected new PDF files */}
                                {pdfFiles.length > 0 && (
                                    <div className="space-y-1.5 mt-2">
                                        <div className="text-[11px] font-bold text-slate-600">
                                            Selected PDF Documents ({pdfFiles.length}):
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {pdfFiles.map((file, idx) => (
                                                <div
                                                    key={idx}
                                                    className="p-2.5 bg-white border border-blue-200 rounded-lg flex items-center justify-between text-xs shadow-2xs"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="w-4 h-4 text-red-500 shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="truncate font-bold text-slate-800 text-[11px]">
                                                                {file.name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500">
                                                                {(file.size / (1024 * 1024)).toFixed(2)} MB &bull; PDF
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                                                            READY
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePdfFile(idx)}
                                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                                            title="Remove file"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 5: Secure External Cloud Links (Infrastructure Projects Only) */}
                            {isInfraProject && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                            <span>Secure External Document Links (HTTPS Only)</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            Infrastructure Project
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        Input verified cloud repository URLs (Google Drive, OneDrive, Gov Document Portals) for supplementary files. Available only for Infrastructure projects.
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-3 rounded-xl border border-slate-200">
                                        <div className="sm:col-span-4">
                                            <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                                Link Title / Description
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Terms of Reference / Cloud Specs"
                                                value={newLinkTitle}
                                                onChange={(e) => setNewLinkTitle(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                                            />
                                        </div>
                                        <div className="sm:col-span-6">
                                            <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                                Secure URL <span className="text-emerald-600 font-mono">(Must begin with https://)</span>
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                                                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                                                </div>
                                                <input
                                                    type="url"
                                                    placeholder="https://drive.google.com/..."
                                                    value={newLinkUrl}
                                                    onChange={(e) => setNewLinkUrl(e.target.value)}
                                                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono"
                                                />
                                            </div>
                                        </div>
                                        <div className="sm:col-span-2 flex items-end">
                                            <button
                                                type="button"
                                                onClick={handleAddSecureLink}
                                                className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Add Link</span>
                                            </button>
                                        </div>
                                    </div>

                                    {linkError && (
                                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                            <span>{linkError}</span>
                                        </div>
                                    )}

                                    {/* List of added secure links */}
                                    {secureLinks.length > 0 && (
                                        <div className="space-y-1.5 mt-2">
                                            <div className="text-[11px] font-bold text-slate-600">
                                                Registered Secure Cloud Links ({secureLinks.length}):
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {secureLinks.map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="p-2.5 bg-white border border-emerald-200 rounded-lg flex items-center justify-between text-xs shadow-2xs"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                                            <div className="min-w-0">
                                                                <p className="truncate font-bold text-slate-800 text-[11px]">
                                                                    {item.title}
                                                                </p>
                                                                <a
                                                                    href={item.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[10px] text-blue-600 hover:underline truncate block flex items-center gap-1 font-mono"
                                                                >
                                                                    <span>{item.url}</span>
                                                                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                                                </a>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                                                                HTTPS
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveSecureLink(idx)}
                                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                                                title="Remove link"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Section 6: Existing Inherited PPMP Attachments */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                                <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-600" />
                                    <span>Inherited PPMP / APP Requirement Attachments</span>
                                </div>
                                {fetchedData?.attachments && fetchedData.attachments.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {fetchedData.attachments.map((att) => (
                                            <div
                                                key={att.id}
                                                className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FileText className="w-4 h-4 text-red-500 shrink-0" />
                                                    <span className="truncate font-medium text-slate-800">
                                                        {att.original_filename}
                                                    </span>
                                                </div>
                                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 rounded">
                                                    {att.attachment_type || 'PDF'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">
                                        No prior PPMP attachments were uploaded. Any PDF files and secure links attached above will be bundled with this Purchase Request.
                                    </p>
                                )}
                            </div>

                            {/* Footer Buttons */}
                            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition cursor-pointer"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Generating Purchase Request...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileCheck2 className="w-4 h-4" />
                                            <span>Generate Purchase Request (PR)</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

