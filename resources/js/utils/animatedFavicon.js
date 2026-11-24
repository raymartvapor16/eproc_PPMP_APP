
const FAVICON_SIZE = 64;

class FaviconAnimator {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = FAVICON_SIZE;
        this.canvas.height = FAVICON_SIZE;
        this.ctx = this.canvas.getContext('2d');
        this.currentLink = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized || !this.ctx) return;
        this.initialized = true;

        this.ensureFaviconLink();

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const dataUrl = this.renderStaticIcon(img);
            if (dataUrl) {
                this.applyFavicon(dataUrl);
            }
        };
        img.src = '/images/davaodelsur-seal.png';
    }

    ensureFaviconLink() {
        const existing = document.querySelectorAll("link[rel*='icon']");
        if (existing.length > 0) {
            this.currentLink = existing[0];
            for (let i = 1; i < existing.length; i++) {
                existing[i].remove();
            }
        } else {
            const link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            document.head.appendChild(link);
            this.currentLink = link;
        }
    }

    renderStaticIcon(img) {
        const ctx = this.ctx;
        const s = FAVICON_SIZE;
        const half = s / 2;
        const radius = half - 2;

        ctx.clearRect(0, 0, s, s);
        ctx.save();

        ctx.beginPath();
        ctx.arc(half, half, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const bgGrad = ctx.createRadialGradient(half, half, 2, half, half, radius);
        bgGrad.addColorStop(0, '#1e3a8a');
        bgGrad.addColorStop(1, '#0a1628');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, s, s);

        const pad = 2;
        ctx.drawImage(img, pad, pad, s - pad * 2, s - pad * 2);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(half, half, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        return this.canvas.toDataURL('image/png');
    }

    applyFavicon(dataUrl) {
        if (!this.currentLink) {
            this.ensureFaviconLink();
        }
        if (this.currentLink) {
            this.currentLink.type = 'image/png';
            this.currentLink.href = dataUrl;
        }
    }
}

let animatorInstance = null;

export function initAnimatedFavicon() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!animatorInstance) {
        animatorInstance = new FaviconAnimator();
        animatorInstance.init();
    }
}
