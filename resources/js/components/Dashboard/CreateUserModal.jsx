import React, { useState, useEffect } from 'react';
import { UserPlus, X, Eye, EyeOff, Shield, Building, Phone, Mail, User, Briefcase, Lock, PenTool, Check, Loader2, Sparkles, UploadCloud, Layers } from 'lucide-react';
import { userService, portalSystemService } from '../../services/api';
import { SignaturePadModal } from '../UI/SignaturePadModal';
import { AccountCodeMultiSelect } from '../UI/AccountCodeMultiSelect';

const ROLES_LIST = [
    { value: 'end_user', label: 'End User (Implementing Unit Staff)', desc: 'Prepares and submits PPMP documents' },
    { value: 'head', label: 'Head of Office / Department Head', desc: 'Endorses office procurement and final approval' },
    { value: 'budget_officer', label: 'Provincial Budget Officer (PBO)', desc: 'Certifies funding allocations and appropriations' },
    { value: 'oppmo', label: 'OPPMO / BAC Secretariat', desc: 'Procurement evaluation, consolidation, and scheduling' },
    { value: 'twg', label: 'BAC - Technical Working Group (TWG)', desc: 'Conducts technical reviews and product evaluations' },
    { value: 'pacco', label: 'PACCO Reviewer (Provincial Accountant)', desc: 'Audits trust funds and special accounting requirements' },
    { value: 'authorized_staff', label: 'Authorize Staff (Acting Head)', desc: 'Endorses procurement documents with authorization letter' },
    { value: 'monitor', label: 'OPPMO Monitoring Officer', desc: 'Monitors timeline and processes across all OPPMO divisions' },
    { value: 'admin', label: 'System Administrator', desc: 'User credential control, security, and master data' },
    { value: 'super_admin', label: 'Super Administrator', desc: 'Full executive oversight, analytics, and dev controls' },
];

export const CreateUserModal = ({
    isOpen,
    onClose,
    onSuccess,
    offices = [],
    currentUserRole = 'admin',
}) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: 'Password123!',
        role: 'end_user',
        office_id: offices.length > 0 ? offices[0].id : '',
        designation: '',
        phone_number: '',
        address: '',
        signature: '',
    });

    const [availableSystems, setAvailableSystems] = useState([]);
    const [accessibleSystems, setAccessibleSystems] = useState([]);
    const [selectedRoles, setSelectedRoles] = useState(['end_user']);
    const [assignedAccountCodeIds, setAssignedAccountCodeIds] = useState([]);

    const [showPassword, setShowPassword] = useState(false);
    const [signaturePreview, setSignaturePreview] = useState(null);
    const [signatureMeta, setSignatureMeta] = useState({
        signatureType: 'optional',
        expirationDate: '',
        pnpkiProofFile: null,
        existingProofName: '',
        captureMethod: 'drawn',
    });
    const [isDrawPadOpen, setIsDrawPadOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const fetchSystems = async () => {
            try {
                const res = await portalSystemService.getPublic();
                const list = Array.isArray(res.data) ? res.data : [];
                const activeList = list.filter((sys) => !sys.status || sys.status === 'active');
                setAvailableSystems(activeList);
                const validUrls = new Set(activeList.map((s) => s.link_url));
                setAccessibleSystems((prev) => {
                    const pruned = prev.filter((url) => validUrls.has(url));
                    if (pruned.length > 0) return pruned;
                    return validUrls.has('/eprocrementppmpapp')
                        ? ['/eprocrementppmpapp']
                        : activeList.slice(0, 1).map((s) => s.link_url);
                });
            } catch (_) {
                setAvailableSystems([]);
            }
        };
        fetchSystems();
        window.addEventListener('portal-systems:updated', fetchSystems);
        return () => window.removeEventListener('portal-systems:updated', fetchSystems);
    }, [isOpen]);

    if (!isOpen) return null;

    const availableRoles = ROLES_LIST.filter(r => {
        if (r.value === 'super_admin' && currentUserRole !== 'super_admin') {
            return false;
        }
        return true;
    });

    const generateRandomPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
        let pass = '';
        for (let i = 0; i < 10; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setFormData(prev => ({ ...prev, password: pass }));
    };

    const handleFileSignature = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file (PNG, JPG, WebP).');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            setSignaturePreview(result);
            setFormData(prev => ({ ...prev, signature: result }));
        };
        reader.readAsDataURL(file);
    };

    const handleDrawSignatureSave = (dataUrl, meta = null) => {
        setSignaturePreview(dataUrl);
        setFormData(prev => ({ ...prev, signature: dataUrl }));
        if (meta) {
            setSignatureMeta({
                signatureType: meta.signatureType || 'optional',
                expirationDate: meta.expirationDate || '',
                pnpkiProofFile: meta.pnpkiProofFile || null,
                existingProofName: meta.existingProofName || meta.pnpkiProofFile?.name || '',
                captureMethod: meta.captureMethod || 'drawn',
            });
        }
        setIsDrawPadOpen(false);
    };

    const clearSignature = () => {
        setSignaturePreview(null);
        setFormData(prev => ({ ...prev, signature: '' }));
        setSignatureMeta({
            signatureType: 'optional',
            expirationDate: '',
            pnpkiProofFile: null,
            existingProofName: '',
            captureMethod: 'drawn',
        });
    };

    const toggleSystem = (url) => {
        setAccessibleSystems(prev => {
            if (prev.includes(url)) {
                if (prev.length === 1) return prev;
                return prev.filter(u => u !== url);
            } else {
                return [...prev, url];
            }
        });
    };

    const toggleRole = (roleValue) => {
        setSelectedRoles((prev) => {
            const exists = prev.includes(roleValue);
            let next;
            if (exists) {
                if (prev.length === 1) return prev;
                next = prev.filter((r) => r !== roleValue);
            } else {
                next = [...prev, roleValue];
            }
            setFormData((fd) => ({ ...fd, role: next[0] || 'end_user' }));
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        if (!formData.name.trim()) {
            setErrorMessage('Full name is required.');
            return;
        }
        if (!formData.email.trim()) {
            setErrorMessage('Email address is required.');
            return;
        }
        if (!formData.password || formData.password.length < 6) {
            setErrorMessage('Password must be at least 6 characters.');
            return;
        }
        if (!accessibleSystems || accessibleSystems.length === 0) {
            setErrorMessage('Please grant access to at least one digital system.');
            return;
        }

        setLoading(true);
        try {
            let payload;
            if (signatureMeta.pnpkiProofFile) {
                payload = new FormData();
                Object.keys(formData).forEach((key) => {
                    if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
                        payload.append(key, formData[key]);
                    }
                });
                payload.append('signature_type', signatureMeta.signatureType || 'optional');
                payload.append('signature_capture_method', signatureMeta.captureMethod || 'drawn');
                if (signatureMeta.signatureType === 'pnpki') {
                    payload.append('pnpki_expiration_date', signatureMeta.expirationDate || '');
                    payload.append('pnpki_proof_pdf', signatureMeta.pnpkiProofFile);
                }
                payload.append('roles', JSON.stringify(selectedRoles));
                payload.append('accessible_systems', JSON.stringify(accessibleSystems));
                if (selectedRoles.includes('twg') && assignedAccountCodeIds.length > 0) {
                    assignedAccountCodeIds.forEach((id) => payload.append('account_code_ids[]', id));
                }
            } else {
                payload = {
                    ...formData,
                    role: selectedRoles[0] || formData.role,
                    roles: selectedRoles,
                    office_id: formData.office_id ? Number(formData.office_id) : null,
                    signature_type: signatureMeta.signatureType || 'optional',
                    signature_capture_method: signatureMeta.captureMethod || 'drawn',
                    pnpki_expiration_date:
                        signatureMeta.signatureType === 'pnpki' ? signatureMeta.expirationDate : null,
                    accessible_systems: accessibleSystems,
                    account_code_ids: selectedRoles.includes('twg') ? assignedAccountCodeIds : [],
                };
            }

            const res = await userService.create(payload);
            const newUser = res.data?.user || res.data;
            if (onSuccess) {
                onSuccess(newUser, res.data?.message || 'User created successfully.');
            }
            onClose();
        } catch (err) {
            console.error('Failed to create user:', err);
            const serverMsg = err.response?.data?.message || 'Failed to create user account. Please check inputs.';
            const validationErrors = err.response?.data?.errors;
            if (validationErrors) {
                const firstErr = Object.values(validationErrors).flat()[0];
                setErrorMessage(firstErr || serverMsg);
            } else {
                setErrorMessage(serverMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
                <div
                    className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                >

                    <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm tracking-wide uppercase">
                                    Add New User Account
                                </h3>
                                <p className="text-[11px] text-slate-400">
                                    Create and immediately activate official credentials for government personnel
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
                        {errorMessage && (
                            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium flex items-center justify-between">
                                <span>{errorMessage}</span>
                                <button type="button" onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-600">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Full Name <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. JUAN DELA CRUZ, CPA"
                                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Email Address <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="username@davaodelsur.gov.ph"
                                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-700">
                                        Initial Password <span className="text-rose-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={generateRandomPassword}
                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                                    >
                                        <Sparkles className="w-3 h-3" /> Generate
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full text-xs pl-9 pr-9 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                                        placeholder="Min 6 characters"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="sm:col-span-2 bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Shield className="w-3.5 h-3.5 text-blue-600" />
                                        System Role(s) &amp; Permissions <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                        {selectedRoles.length} {selectedRoles.length === 1 ? 'Role' : 'Roles'} Selected
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-2">
                                    Select one or more roles for this account. Multi-role users will be prompted to choose their active role upon login.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                                    {availableRoles.map((r) => {
                                        const isChecked = selectedRoles.includes(r.value);
                                        return (
                                            <button
                                                key={r.value}
                                                type="button"
                                                onClick={() => toggleRole(r.value)}
                                                className={`flex items-start gap-2 p-2 rounded-lg border text-left transition cursor-pointer ${
                                                    isChecked
                                                        ? 'bg-blue-50 border-blue-400 text-blue-950'
                                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span
                                                    className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                                        isChecked
                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                            : 'bg-white border-slate-300'
                                                    }`}
                                                >
                                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-[11px] font-bold leading-tight">{r.label}</span>
                                                    <span className="block text-[10px] text-slate-500 leading-snug">{r.desc}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedRoles.includes('twg') && (
                                <div className="sm:col-span-2 bg-amber-50/70 border-2 border-amber-300 rounded-xl p-3.5 space-y-2 animate-fade-in-up">
                                    <AccountCodeMultiSelect
                                        selectedIds={assignedAccountCodeIds}
                                        onChange={setAssignedAccountCodeIds}
                                        label="Assigned Account Codes (TWG Scope)"
                                    />
                                </div>
                            )}

                            <div className="sm:col-span-2 bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                        Permitted Digital Systems <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                        {accessibleSystems.length} Selected
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-2">
                                    Check which provincial digital systems this user can access after account creation.
                                </p>
                                <div className="space-y-1.5">
                                    {availableSystems.map((sys) => {
                                        const isChecked = accessibleSystems.includes(sys.link_url);
                                        return (
                                            <div
                                                key={sys.id || sys.link_url}
                                                onClick={() => toggleSystem(sys.link_url)}
                                                className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                                                    isChecked
                                                        ? 'bg-indigo-50/90 border-indigo-300 text-slate-900 shadow-xs'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}}
                                                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                                        <span>{sys.name}</span>
                                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                                                            {sys.link_url}
                                                        </span>
                                                    </div>
                                                    {sys.description && (
                                                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                                            {sys.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Department / Implementing Office
                                </label>
                                <div className="relative">
                                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                    <select
                                        value={formData.office_id}
                                        onChange={(e) => setFormData({ ...formData, office_id: e.target.value })}
                                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                                    >
                                        <option value="">— Provincial Capitol General (No Specific Office) —</option>
                                        {offices.map(o => (
                                            <option key={o.id} value={o.id}>
                                                {o.code ? `[${o.code}] ` : ''}{o.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Position / Designation
                                </label>
                                <div className="relative">
                                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={formData.designation}
                                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                        placeholder="e.g. Administrative Officer V"
                                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Phone / Contact Number
                                </label>
                                <div className="relative">
                                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={formData.phone_number}
                                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                        placeholder="0912 345 6789"
                                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    User Address
                                </label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="e.g. Digos City, Davao del Sur"
                                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                                            Official Specimen E-Signature (Optional)
                                        </label>
                                        <span className="text-[11px] text-slate-500">
                                            Attach a transparent signature image or draw directly to enable automatic document stamping.
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition">
                                            <UploadCloud className="w-3.5 h-3.5" /> Upload File
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileSignature}
                                                className="hidden"
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsDrawPadOpen(true)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition cursor-pointer"
                                        >
                                            <PenTool className="w-3.5 h-3.5" /> Draw Pad
                                        </button>
                                    </div>
                                </div>

                                {signaturePreview ? (
                                    <div className="relative border border-slate-300 rounded-xl p-3 bg-slate-50/80 flex items-center justify-center min-h-[100px]">
                                        <img
                                            src={signaturePreview}
                                            alt="Specimen Preview"
                                            className="max-h-24 object-contain"
                                        />
                                        <button
                                            type="button"
                                            onClick={clearSignature}
                                            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                                            title="Remove signature"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center text-slate-400 text-xs italic bg-slate-50/50">
                                        No signature attached yet. You can also upload or draw this later.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Creating Account...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>Create & Activate User</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {isDrawPadOpen && (
                <SignaturePadModal
                    isOpen={isDrawPadOpen}
                    onClose={() => setIsDrawPadOpen(false)}
                    onSave={handleDrawSignatureSave}
                    initialDataUrl={signaturePreview}
                    initialMeta={signatureMeta}
                    title="Personnel Official Specimen Signature Studio"
                    description="Choose PNPKI Digital E-Signature or Optional Digital Signature, then draw or attach the official signature."
                />
            )}
        </>
    );
};
export default CreateUserModal;
