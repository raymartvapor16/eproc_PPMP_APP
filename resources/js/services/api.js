import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
    withCredentials: true,
});

// Helper to update CSRF token everywhere in memory and DOM
export const setCsrfToken = (newToken) => {
    if (!newToken) return;
    let meta = document.head.querySelector('meta[name="csrf-token"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'csrf-token';
        document.head.appendChild(meta);
    }
    meta.content = newToken;
    api.defaults.headers.common['X-CSRF-TOKEN'] = newToken;
};

// Auto-inject initial CSRF token if present
const initialToken = document.head.querySelector('meta[name="csrf-token"]');
if (initialToken && initialToken.content) {
    setCsrfToken(initialToken.content);
}

// Request interceptor: always inject latest CSRF token
api.interceptors.request.use((config) => {
    const meta = document.head.querySelector('meta[name="csrf-token"]');
    if (meta && meta.content) {
        config.headers['X-CSRF-TOKEN'] = meta.content;
    }
    return config;
});

// Flag to prevent infinite retry loops on 419
let isRefreshingCsrf = false;

// Global response interceptor for 401 (unauthorized) and 419 (CSRF token expired)
api.interceptors.response.use(
    (response) => {
        // If server sent an updated CSRF token, adopt it immediately
        if (response.data && response.data.csrf_token) {
            setCsrfToken(response.data.csrf_token);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // HTTP 419: CSRF Token Expired / Mismatched -> Fetch fresh token and retry once
        if (error.response && error.response.status === 419 && !originalRequest._retry && !isRefreshingCsrf) {
            originalRequest._retry = true;
            isRefreshingCsrf = true;

            try {
                const tokenRes = await axios.get('/api/csrf-token', { withCredentials: true });
                if (tokenRes.data && tokenRes.data.csrf_token) {
                    setCsrfToken(tokenRes.data.csrf_token);
                    originalRequest.headers['X-CSRF-TOKEN'] = tokenRes.data.csrf_token;
                    isRefreshingCsrf = false;
                    return api(originalRequest);
                }
            } catch (refreshErr) {
                isRefreshingCsrf = false;
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                return Promise.reject(refreshErr);
            }
            isRefreshingCsrf = false;
        }

        // HTTP 401: Unauthenticated or session invalidated (e.g. anti-hijacking triggered)
        if (error.response && error.response.status === 401) {
            if (window.location.pathname !== '/login') {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            }
        }
        return Promise.reject(error);
    }
);

export const authService = {
    login: async (credentials) => {
        const res = await api.post('/login', credentials);
        if (res.data && res.data.csrf_token) {
            setCsrfToken(res.data.csrf_token);
        }
        return res;
    },
    register: (data) => {
        if (data instanceof FormData) {
            return api.post('/register', data, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        }
        return api.post('/register', data);
    },
    getPublicOffices: () => api.get('/public-offices'),
    logout: async () => {
        try {
            const res = await api.post('/logout');
            if (res.data && res.data.csrf_token) {
                setCsrfToken(res.data.csrf_token);
            }
            return res;
        } catch (e) {
            // Even if logout fails, purge token and dispatch
            return e;
        }
    },
    getCsrfToken: () => api.get('/csrf-token'),
    getProfile: () => api.get('/me'),
    updateProfile: (data) => api.put('/profile', data),
    getSignatureUrl: () => '/api/profile/signature',
};

export const ppmpService = {
    getAll: (params) => api.get('/ppmps', { params }),
    getOne: (uuid) => api.get(`/ppmps/${uuid}`),
    create: (data) => api.post('/ppmps', data),
    update: (uuid, data) => api.put(`/ppmps/${uuid}`, data),

    // Workflow actions
    submitToHead: (uuid) => api.post(`/ppmps/${uuid}/submit-to-head`),
    headApprove: (uuid) => api.post(`/ppmps/${uuid}/head/approve`),
    headReturn: (uuid, data) => api.post(`/ppmps/${uuid}/head/return`, data),

    submitForReview: (uuid) => api.post(`/ppmps/${uuid}/submit-for-review`),

    budgetApprove: (uuid) => api.post(`/ppmps/${uuid}/budget/approve`),
    budgetReturn: (uuid, data) => api.post(`/ppmps/${uuid}/budget/return`, data),

    paccoApprove: (uuid) => api.post(`/ppmps/${uuid}/pacco/approve`),
    paccoReturn: (uuid, data) => api.post(`/ppmps/${uuid}/pacco/return`, data),

    oppmoApprove: (uuid) => api.post(`/ppmps/${uuid}/oppmo/approve`),
    oppmoReturn: (uuid, data) => api.post(`/ppmps/${uuid}/oppmo/return`, data),

    twgApprove: (uuid) => api.post(`/ppmps/${uuid}/twg/approve`),
    twgReturn: (uuid, data) => api.post(`/ppmps/${uuid}/twg/return`, data),

    receive: (uuid) => api.post(`/ppmps/${uuid}/receive`),

    // Attachments
    uploadAttachment: (uuid, formData) => api.post(`/ppmps/${uuid}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    updateAttachmentType: (uuid, attachment, type) => {
        const attKey = (typeof attachment === 'object' && attachment !== null)
            ? (attachment.encrypted_uuid || attachment.uuid)
            : attachment;
        return api.patch(`/ppmps/${uuid}/attachments/${attKey}/type`, { attachment_type: type });
    },
    deleteAttachment: (uuid, attachment) => {
        const attKey = (typeof attachment === 'object' && attachment !== null)
            ? (attachment.encrypted_uuid || attachment.uuid)
            : attachment;
        return api.delete(`/ppmps/${uuid}/attachments/${attKey}`);
    },
    getAttachmentViewUrl: (uuid, attachment) => {
        const attKey = (typeof attachment === 'object' && attachment !== null)
            ? (attachment.encrypted_uuid || attachment.uuid)
            : attachment;
        return `/api/ppmps/${uuid}/attachments/${attKey}/view`;
    },
    getAttachmentDownloadUrl: (uuid, attachment) => {
        const attKey = (typeof attachment === 'object' && attachment !== null)
            ? (attachment.encrypted_uuid || attachment.uuid)
            : attachment;
        return `/api/ppmps/${uuid}/attachments/${attKey}/download`;
    },
    saveAttachmentList: (uuid, data) => api.post(`/ppmps/${uuid}/attachment-list`, data),
    saveAppData: (uuid, data) => api.post(`/ppmps/${uuid}/app-data`, data),
    requestAmendmentOrSupplemental: (uuid, formData) => api.post(`/ppmps/${uuid}/request-amendment-or-supplemental`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    approveAmendment: (uuid) => api.post(`/ppmps/${uuid}/amendment/approve`),
    rejectAmendment: (uuid, data) => api.post(`/ppmps/${uuid}/amendment/reject`, data),
};

export const dashboardService = {
    getDashboard: () => api.get('/dashboard'),
};

export const notificationService = {
    getAll: (params) => api.get('/notifications', { params }),
    markAsRead: (id) => api.post(`/notifications/${id}/read`),
    markAllAsRead: () => api.post('/notifications/read-all'),
    delete: (id) => api.delete(`/notifications/${id}`),
    clearAll: () => api.delete('/notifications'),
    getOffices: () => api.get('/offices'),
};

export const signatoryService = {
    getAll: () => api.get('/signatories'),
    create: (data) => api.post('/signatories', data),
    update: (id, data) => api.put(`/signatories/${id}`, data),
    delete: (id) => api.delete(`/signatories/${id}`),
};

export const userService = {
    getAll: () => api.get('/users'),
    create: (data) => api.post('/users', data),
    updateSignature: (id, data) => api.post(`/users/${id}/signature`, data),
    changePassword: (id, password) => api.post(`/users/${id}/change-password`, { password }),
    updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
    updateSystemAccess: (id, systems) => api.put(`/users/${id}/system-access`, { accessible_systems: systems }),
    approve: (id) => api.post(`/users/${id}/approve`),
    reject: (id, reason = '') => api.post(`/users/${id}/reject`, { reason }),
    toggleStatus: (id) => api.post(`/users/${id}/toggle-status`),
    delete: (id) => api.delete(`/users/${id}`),
    getUserSignatureUrl: (id) => `/api/users/${id}/signature`,
    getUserAuthorizationLetterUrl: (id) => `/api/users/${id}/authorization-letter`,
};

export const officeService = {
    getAll: () => api.get('/offices-list'),
    create: (data) => api.post('/offices', data),
    update: (id, data) => api.put(`/offices/${id}`, data),
    delete: (id) => api.delete(`/offices/${id}`),
    importOffices: (rows) => api.post('/offices/import', { rows }),
};

export const fundSourceService = {
    getAll: (params) => api.get('/fund-sources', { params }),
    create: (data) => api.post('/fund-sources', data),
    update: (id, data) => api.put(`/fund-sources/${id}`, data),
    delete: (id) => api.delete(`/fund-sources/${id}`),
};

export const procurementConditionService = {
    getAll: (params) => api.get('/procurement-conditions', { params }),
    create: (data) => api.post('/procurement-conditions', data),
    update: (id, data) => api.put(`/procurement-conditions/${id}`, data),
    delete: (id) => api.delete(`/procurement-conditions/${id}`),
};

let cachedProcurementModes = null;
let cachedProcurementModesPromise = null;

export const procurementModeService = {
    getAll: async (params = {}) => {
        if (!params?.active_only) {
            return api.get('/procurement-modes', { params });
        }
        if (cachedProcurementModes) {
            return { data: cachedProcurementModes };
        }
        if (cachedProcurementModesPromise) {
            return cachedProcurementModesPromise;
        }
        cachedProcurementModesPromise = api.get('/procurement-modes', { params })
            .then(res => {
                cachedProcurementModes = Array.isArray(res.data) ? res.data : [];
                return { data: cachedProcurementModes };
            })
            .catch(err => {
                cachedProcurementModes = null;
                throw err;
            })
            .finally(() => {
                cachedProcurementModesPromise = null;
            });
        return cachedProcurementModesPromise;
    },
    invalidateCache: () => {
        cachedProcurementModes = null;
        cachedProcurementModesPromise = null;
    },
    create: async (data) => {
        const res = await api.post('/procurement-modes', data);
        procurementModeService.invalidateCache();
        return res;
    },
    update: async (id, data) => {
        const res = await api.put(`/procurement-modes/${id}`, data);
        procurementModeService.invalidateCache();
        return res;
    },
    toggleStatus: async (id) => {
        const res = await api.patch(`/procurement-modes/${id}/toggle-status`);
        procurementModeService.invalidateCache();
        return res;
    },
    delete: async (id) => {
        const res = await api.delete(`/procurement-modes/${id}`);
        procurementModeService.invalidateCache();
        return res;
    },
};

export const otherTermService = {
    getAll: (params) => api.get('/other-terms', { params }),
    create: (data) => api.post('/other-terms', data),
    update: (id, data) => api.put(`/other-terms/${id}`, data),
    delete: (id) => api.delete(`/other-terms/${id}`),
};

let cachedSupportingDocs = null;
let cachedSupportingDocsPromise = null;

export const supportingDocumentService = {
    getAll: async (params = {}) => {
        if (!params?.active_only) {
            return api.get('/supporting-documents', { params });
        }
        if (cachedSupportingDocs) {
            return { data: cachedSupportingDocs };
        }
        if (cachedSupportingDocsPromise) {
            return cachedSupportingDocsPromise;
        }
        cachedSupportingDocsPromise = api.get('/supporting-documents', { params })
            .then(res => {
                cachedSupportingDocs = Array.isArray(res.data) ? res.data : [];
                return { data: cachedSupportingDocs };
            })
            .catch(err => {
                cachedSupportingDocs = null;
                throw err;
            })
            .finally(() => {
                cachedSupportingDocsPromise = null;
            });
        return cachedSupportingDocsPromise;
    },
    invalidateCache: () => {
        cachedSupportingDocs = null;
        cachedSupportingDocsPromise = null;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('supporting-documents:changed'));
        }
    },
    create: async (data) => {
        const res = await api.post('/supporting-documents', data);
        supportingDocumentService.invalidateCache();
        return res;
    },
    update: async (id, data) => {
        const res = await api.put(`/supporting-documents/${id}`, data);
        supportingDocumentService.invalidateCache();
        return res;
    },
    delete: async (id) => {
        const res = await api.delete(`/supporting-documents/${id}`);
        supportingDocumentService.invalidateCache();
        return res;
    },
};

export const systemSettingService = {
    getDeveloperMode: () => api.get('/system-settings/developer-mode'),
    updateDeveloperMode: (developer_mode) => api.put('/system-settings/developer-mode', { developer_mode }),
    getSignatureSettings: () => api.get('/system-settings/signatures'),
    updateSignatureSettings: (data) => api.put('/system-settings/signatures', data),
};

export const monitoringService = {
    getStats: () => api.get('/monitoring/stats'),
    getPendingPims: () => api.get('/monitoring/pending-pims'),
    getProjects: (params) => api.get('/monitoring/projects', { params }),
    getProject: (idOrUuid) => api.get(`/monitoring/projects/${idOrUuid}`),
    createProject: (data) => api.post('/monitoring/projects', data),
    updateProject: (idOrUuid, data) => api.put(`/monitoring/projects/${idOrUuid}`, data),
    deleteProject: (idOrUuid) => api.delete(`/monitoring/projects/${idOrUuid}`),
    updatePrId: (idOrUuid, prId) => api.patch(`/monitoring/projects/${idOrUuid}/pr-id`, { pims_pr_id: prId }),
    addStep: (idOrUuid, data) => api.post(`/monitoring/projects/${idOrUuid}/steps`, data),
    updateStep: (stepId, data) => api.put(`/monitoring/steps/${stepId}`, data),
    deleteStep: (stepId) => api.delete(`/monitoring/steps/${stepId}`),
    publishPims: (data) => api.post('/monitoring/pims-publish', data),
    unpublishPims: (data) => api.post('/monitoring/pims-unpublish', data),
};

export const portalSystemService = {
    getPublic: () => api.get('/public-portal-systems'),
    getAll: () => api.get('/portal-systems'),
    create: (data) => api.post('/portal-systems', data),
    update: (id, data) => api.put(`/portal-systems/${id}`, data),
    delete: (id) => api.delete(`/portal-systems/${id}`),
    toggleStatus: (id) => api.patch(`/portal-systems/${id}/toggle-status`),
};

export const oppmoTeamService = {
    getPublic: () => api.get('/public-oppmo-team'),
    getAll: () => api.get('/oppmo-team'),
    create: (data) => {
        if (data instanceof FormData) {
            return api.post('/oppmo-team', data, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
        return api.post('/oppmo-team', data);
    },
    update: (id, data) => {
        if (data instanceof FormData) {
            return api.post(`/oppmo-team/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
        return api.put(`/oppmo-team/${id}`, data);
    },
    delete: (id) => api.delete(`/oppmo-team/${id}`),
    toggleStatus: (id) => api.patch(`/oppmo-team/${id}/toggle-status`),
};

export const supplierEvaluationService = {
    getInit: () => api.get('/supplier-evaluation/dashboard-init'),
    getEvaluations: (params) => api.get('/supplier-evaluation/evaluations', { params }),
    getEvaluation: (id) => api.get(`/supplier-evaluation/evaluations/${id}`),
    createEvaluation: (data) => api.post('/supplier-evaluation/evaluations', data),
    evaluateOrUpdate: (id, data) => api.post(`/supplier-evaluation/evaluations/${id}/evaluate`, data),
    deleteEvaluation: (id) => api.delete(`/supplier-evaluation/evaluations/${id}`),
    restoreEvaluation: (id) => api.post(`/supplier-evaluation/evaluations/${id}/restore`),
    forceDeleteEvaluation: (id) => api.delete(`/supplier-evaluation/evaluations/${id}/force`),

    // Bulk Evaluation
    getBulkSuppliers: () => api.get('/supplier-evaluation/bulk/suppliers'),
    fetchBulkEvaluations: (params) => api.get('/supplier-evaluation/bulk/evaluations', { params }),
    submitBulkEvaluations: (data) => api.post('/supplier-evaluation/bulk/submit', data),

    // Recycle Bin
    getRecycleBin: () => api.get('/supplier-evaluation/recycle-bin'),

    // Purchase Orders
    getPurchaseOrders: (params) => api.get('/supplier-evaluation/purchase-orders', { params }),
    createPurchaseOrder: (formData) => api.post('/supplier-evaluation/purchase-orders', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    updatePurchaseOrder: (id, formData) => api.post(`/supplier-evaluation/purchase-orders/${id}/update`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    deletePurchaseOrder: (id) => api.delete(`/supplier-evaluation/purchase-orders/${id}`),
    uploadPoPdf: (id, formData) => api.post(`/supplier-evaluation/purchase-orders/${id}/upload-pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    importPurchaseOrders: (formData) => api.post('/supplier-evaluation/purchase-orders/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    getBulkPoList: (params) => api.get('/supplier-evaluation/purchase-orders/bulk-list', { params }),
    storeBulkPoEvaluations: (data) => api.post('/supplier-evaluation/purchase-orders/bulk-evaluate', data),

    // Requests
    getRequests: () => api.get('/supplier-evaluation/requests'),
    createRequest: (data) => api.post('/supplier-evaluation/requests', data),
    approveRequest: (id) => api.post(`/supplier-evaluation/requests/${id}/approve`),
    rejectRequest: (id) => api.post(`/supplier-evaluation/requests/${id}/reject`),
    cancelRequest: (id) => api.delete(`/supplier-evaluation/requests/${id}`),

    // Authorize PDFs
    getAuthorizePdfs: () => api.get('/supplier-evaluation/pdfs'),
    uploadAuthorizePdf: (formData) => api.post('/supplier-evaluation/pdfs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    updateAuthorizePdfStatus: (id, status) => api.post(`/supplier-evaluation/pdfs/${id}/status`, { status }),

    // Analytics & Activity Logs
    getAnalytics: (params) => api.get('/supplier-evaluation/analytics', { params }),
    getActivityLogs: (params) => api.get('/supplier-evaluation/activity-logs', { params }),
    getExportActivityLogsUrl: (params) => {
        const qs = new URLSearchParams(params).toString();
        return `/api/supplier-evaluation/activity-logs/export${qs ? `?${qs}` : ''}`;
    },
};

export default api;


