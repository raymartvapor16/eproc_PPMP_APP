import React, { useEffect, useRef } from 'react';

const DEFAULT_PALETTE = [
    '#38bdf8',
    '#60a5fa',
    '#818cf8',
    '#fbbf24',
    '#34d399',
    '#e2e8f0',
];

export function SpiderParticlesCanvas({
    className = '',
    particleCount = null,
    linkDistance = 135,
    cursorDistance = 185,
    palette = DEFAULT_PALETTE,
    opacity = 1,
}) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const prefersReducedMotion =
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        let animationFrameId = null;
        let isRunning = false;
        let isInViewport = true;
        let isTabVisible = typeof document !== 'undefined' ? !document.hidden : true;
        let lastFrameTime = 0;
        const FRAME_INTERVAL = 1000 / 30;

        let particles = [];
        let width = 0;
        let height = 0;
        let cachedRect = { left: 0, top: 0, width: 0, height: 0 };

        const mouse = {
            x: null,
            y: null,
            vx: 0,
            vy: 0,
            lastX: null,
            lastY: null,
            active: false,
        };

        const hexToRgb = (hex) => {
            const clean = hex.replace('#', '');
            const num = parseInt(clean, 16);
            return {
                r: (num >> 16) & 255,
                g: (num >> 8) & 255,
                b: num & 255,
            };
        };

        const rgbPalette = palette.map(hexToRgb);

        class Particle {
            constructor(w, h) {
                this.x = Math.random() * w;
                this.y = Math.random() * h;
                const speed = 0.16 + Math.random() * 0.28;
                const angle = Math.random() * Math.PI * 2;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.baseVx = this.vx;
                this.baseVy = this.vy;
                this.radius = 1.3 + Math.random() * 1.6;
                this.color = rgbPalette[Math.floor(Math.random() * rgbPalette.length)];
                this.alpha = 0.45 + Math.random() * 0.4;
                this.pulseSpeed = 0.012 + Math.random() * 0.015;
                this.pulsePhase = Math.random() * Math.PI * 2;
            }

            update(w, h) {
                this.pulsePhase += this.pulseSpeed;

                if (mouse.active && mouse.x !== null && mouse.y !== null) {
                    const dx = mouse.x - this.x;
                    const dy = mouse.y - this.y;
                    const distSq = dx * dx + dy * dy;
                    const maxDistSq = cursorDistance * cursorDistance;

                    if (distSq < maxDistSq && distSq > 1) {
                        const dist = Math.sqrt(distSq);
                        const force = (cursorDistance - dist) / cursorDistance;

                        if (dist > 48) {
                            this.vx += (dx / dist) * force * 0.02;
                            this.vy += (dy / dist) * force * 0.02;
                        } else {
                            this.vx -= (dx / dist) * force * 0.04;
                            this.vy -= (dy / dist) * force * 0.04;
                        }

                        this.vx += mouse.vx * force * 0.006;
                        this.vy += mouse.vy * force * 0.006;
                    }
                }

                this.vx += (this.baseVx - this.vx) * 0.025;
                this.vy += (this.baseVy - this.vy) * 0.025;

                const maxSpeed = 1.35;
                const speedSq = this.vx * this.vx + this.vy * this.vy;
                if (speedSq > maxSpeed * maxSpeed) {
                    const currentSpeed = Math.sqrt(speedSq);
                    this.vx = (this.vx / currentSpeed) * maxSpeed;
                    this.vy = (this.vy / currentSpeed) * maxSpeed;
                }

                this.x += this.vx;
                this.y += this.vy;

                const pad = 16;
                if (this.x < -pad) this.x = w + pad;
                else if (this.x > w + pad) this.x = -pad;
                if (this.y < -pad) this.y = h + pad;
                else if (this.y > h + pad) this.y = -pad;
            }

            draw(context) {
                const pulse = 0.85 + Math.sin(this.pulsePhase) * 0.15;
                const currentAlpha = Math.min(1, Math.max(0.15, this.alpha * pulse));
                const { r, g, b } = this.color;

                context.beginPath();
                context.arc(this.x, this.y, this.radius * 2.1, 0, Math.PI * 2);
                context.fillStyle = `rgba(${r}, ${g}, ${b}, ${currentAlpha * 0.18})`;
                context.fill();

                context.beginPath();
                context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                context.fillStyle = `rgba(${r}, ${g}, ${b}, ${currentAlpha})`;
                context.fill();
            }
        }

        const updateCachedRect = () => {
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            cachedRect = {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            };
        };

        const initParticles = () => {
            const rect = canvas.getBoundingClientRect();
            width = Math.max(1, rect.width || window.innerWidth);
            height = Math.max(1, rect.height || window.innerHeight);
            cachedRect = {
                left: rect.left,
                top: rect.top,
                width,
                height,
            };

            const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const computedCount =
                particleCount !== null
                    ? Math.min(particleCount, 36)
                    : Math.min(32, Math.max(16, Math.floor((width * height) / 36000)));

            particles = Array.from({ length: computedCount }, () => new Particle(width, height));
        };

        const handleMouseMove = (e) => {
            if (!isInViewport || !isTabVisible) return;
            const x = e.clientX - cachedRect.left;
            const y = e.clientY - cachedRect.top;

            if (x >= 0 && x <= cachedRect.width && y >= 0 && y <= cachedRect.height) {
                if (mouse.lastX !== null && mouse.lastY !== null) {
                    mouse.vx = x - mouse.lastX;
                    mouse.vy = y - mouse.lastY;
                }
                mouse.x = x;
                mouse.y = y;
                mouse.lastX = x;
                mouse.lastY = y;
                mouse.active = true;
            } else {
                mouse.active = false;
            }
        };

        const handleMouseLeave = () => {
            mouse.active = false;
            mouse.x = null;
            mouse.y = null;
        };

        const handleTouchMove = (e) => {
            if (!isInViewport || !isTabVisible || !e.touches || e.touches.length === 0) return;
            const touch = e.touches[0];
            const x = touch.clientX - cachedRect.left;
            const y = touch.clientY - cachedRect.top;

            if (x >= 0 && x <= cachedRect.width && y >= 0 && y <= cachedRect.height) {
                mouse.x = x;
                mouse.y = y;
                mouse.active = true;
            } else {
                mouse.active = false;
            }
        };

        const handleTouchEnd = () => {
            mouse.active = false;
        };

        const renderFrame = () => {
            ctx.clearRect(0, 0, width, height);

            mouse.vx *= 0.9;
            mouse.vy *= 0.9;

            const len = particles.length;
            const linkDistSq = linkDistance * linkDistance;
            const cursorDistSq = cursorDistance * cursorDistance;

            for (let i = 0; i < len; i++) {
                const p1 = particles[i];
                if (!prefersReducedMotion) {
                    p1.update(width, height);
                }
                p1.draw(ctx);

                for (let j = i + 1; j < len; j++) {
                    const p2 = particles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < linkDistSq) {
                        const dist = Math.sqrt(distSq);
                        const alpha = (1 - dist / linkDistance) * 0.22;
                        const { r, g, b } = p1.color;
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                        ctx.lineWidth = 0.75;
                        ctx.stroke();
                    }
                }

                if (mouse.active && mouse.x !== null && mouse.y !== null) {
                    const mdx = mouse.x - p1.x;
                    const mdy = mouse.y - p1.y;
                    const mDistSq = mdx * mdx + mdy * mdy;

                    if (mDistSq < cursorDistSq) {
                        const mDist = Math.sqrt(mDistSq);
                        const ratio = 1 - mDist / cursorDistance;
                        const lineAlpha = ratio * 0.48;
                        const { r, g, b } = p1.color;

                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${lineAlpha})`;
                        ctx.lineWidth = 0.75 + ratio * 0.85;
                        ctx.stroke();
                    }
                }
            }

            if (mouse.active && mouse.x !== null && mouse.y !== null) {
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, 2.2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(251, 191, 36, 0.75)';
                ctx.fill();
            }
        };

        const animate = (timestamp) => {
            if (!isRunning) return;

            if (timestamp - lastFrameTime >= FRAME_INTERVAL) {
                lastFrameTime = timestamp;
                renderFrame();
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        const startLoop = () => {
            if (prefersReducedMotion) {
                renderFrame();
                return;
            }
            if (!isRunning && isInViewport && isTabVisible) {
                isRunning = true;
                lastFrameTime = 0;
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        const stopLoop = () => {
            isRunning = false;
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        };

        const syncLoopState = () => {
            if (isInViewport && isTabVisible && !prefersReducedMotion) {
                startLoop();
            } else {
                stopLoop();
            }
        };

        initParticles();
        renderFrame();

        let observer = null;
        if (typeof IntersectionObserver !== 'undefined') {
            observer = new IntersectionObserver(
                ([entry]) => {
                    isInViewport = entry.isIntersecting;
                    if (isInViewport) {
                        updateCachedRect();
                    }
                    syncLoopState();
                },
                { threshold: 0.02 }
            );
            observer.observe(canvas);
        }

        const handleVisibilityChange = () => {
            isTabVisible = !document.hidden;
            syncLoopState();
        };

        let resizeTimer = null;
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                initParticles();
                renderFrame();
            }, 150);
        };

        window.addEventListener('resize', handleResize, { passive: true });
        window.addEventListener('scroll', updateCachedRect, { passive: true });
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseout', handleMouseLeave, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });
        document.addEventListener('visibilitychange', handleVisibilityChange);

        syncLoopState();

        return () => {
            stopLoop();
            clearTimeout(resizeTimer);
            if (observer) observer.disconnect();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', updateCachedRect);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseout', handleMouseLeave);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [particleCount, linkDistance, cursorDistance, palette]);

    return (
        <canvas
            ref={canvasRef}
            style={{ opacity }}
            className={`pointer-events-none select-none ${className}`}
            aria-hidden="true"
        />
    );
}

export default SpiderParticlesCanvas;
