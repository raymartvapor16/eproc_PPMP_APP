import React, { useState } from 'react';
import { UserPlus, X, Eye, EyeOff, Shield, Building, Phone, Mail, User, Briefcase, Lock, PenTool, Check, Loader2, Sparkles, UploadCloud } from 'lucide-react';
import { userService } from '../../services/api';
import { SignaturePadModal } from '../UI/SignaturePadModal';

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
    if (!isOpen) return null;

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

    const [showPassword, setShowPassword] = useState(false);
    const [signaturePreview, setSignaturePreview] = useState(null);
    const [isDrawPadOpen, setIsDrawPadOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

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

    const handleDrawSignatureSave = (dataUrl) => {
        setSignaturePreview(dataUrl);
        setFormData(prev => ({ ...prev, signature: dataUrl }));
        setIsDrawPadOpen(false);
    };

    const clearSignature = () => {
        setSignaturePreview(null);
        setFormData(prev => ({ ...prev, signature: '' }));
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

        setLoading(true);
        try {
            const payload = {
                ...formData,
                office_id: formData.office_id ? Number(formData.office_id) : null,
            };

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
                    {/* Modal Header */}
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

                    {/* Modal Form Body */}
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
                            {/* Full Name */}
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

                            {/* Email */}
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

                            {/* Password */}
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

                            {/* Role Selection */}
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    System Role & Permissions <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                                    >
                                        {availableRoles.map(r => (
                                            <option key={r.value} value={r.value}>
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 italic">
                                    {ROLES_LIST.find(r => r.value === formData.role)?.desc}
                                </p>
                            </div>

                            {/* Assigned Department / Office */}
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

                            {/* Position / Designation */}
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

                            {/* Contact Phone */}
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

                            {/* Office Address / Location */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Office Building / Location
                                </label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="e.g. 2nd Floor, Executive Bldg, Capitol"
                                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Specimen Signature Section */}
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

                        {/* Modal Footer Actions */}
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

            {/* Embedded Draw Signature Pad Modal */}
            {isDrawPadOpen && (
                <SignaturePadModal
                    isOpen={isDrawPadOpen}
                    onClose={() => setIsDrawPadOpen(false)}
                    onSave={handleDrawSignatureSave}
                    initialDataUrl={signaturePreview}
                    title="Draw Personnel Official Specimen Signature"
                    description="Draw the official government specimen signature using mouse, stylus, or touch screen."
                />
            )}
        </>
    );
};
export default CreateUserModal;
