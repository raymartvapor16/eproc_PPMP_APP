import React, { useEffect, useRef } from 'react';

const AURORA_PALETTE = [
    { r: 251, g: 191, b: 36 },  // Amber Gold
    { r: 56, g: 189, b: 248 },  // Sky Cyan
    { r: 99, g: 102, b: 241 },  // Indigo
    { r: 52, g: 211, b: 153 },  // Emerald
    { r: 192, g: 132, b: 252 }, // Soft Violet
    { r: 226, g: 232, b: 240 }, // Crisp Starlight
];

function createGlowSprite(r, g, b) {
    const size = 32;
    const half = size / 2;
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const octx = offscreen.getContext('2d');
    if (!octx) return offscreen;

    const grad = octx.createRadialGradient(half, half, 0.5, half, half, half);
    grad.addColorStop(0, `rgba(255, 255, 255, 0.95)`);
    grad.addColorStop(0.22, `rgba(${r}, ${g}, ${b}, 0.85)`);
    grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.22)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    octx.fillStyle = grad;
    octx.fillRect(0, 0, size, size);
    return offscreen;
}

export function AuroraParticlesCanvas({
    className = '',
    opacity = 0.95,
    linkDistance = 128,
    cursorRadius = 175,
}) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const prefersReducedMotion =
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (!ctx) return;

        // Pre-render sprite stamps once (eliminates radialGradient & string allocs per frame)
        const sprites = AURORA_PALETTE.map((c) => createGlowSprite(c.r, c.g, c.b));

        let rafId = null;
        let isRunning = false;
        let isInViewport = true;
        let isTabVisible = typeof document !== 'undefined' ? !document.hidden : true;
        let lastTime = 0;

        let width = 1;
        let height = 1;
        let rectLeft = 0;
        let rectTop = 0;

        let particles = [];
        let meteors = [];
        let meteorCooldown = 2600;

        const pointer = {
            x: -9999,
            y: -9999,
            active: false,
            smoothX: -9999,
            smoothY: -9999,
        };

        const syncBounds = () => {
            const rect = canvas.getBoundingClientRect();
            rectLeft = rect.left;
            rectTop = rect.top;
            return rect;
        };

        const spawnParticles = () => {
            const rect = syncBounds();
            width = Math.max(1, Math.floor(rect.width || window.innerWidth));
            height = Math.max(1, Math.floor(rect.height || window.innerHeight));

            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const count = width < 640 ? 22 : width < 1024 ? 32 : 44;
            particles = new Array(count);

            for (let i = 0; i < count; i++) {
                const depth = 0.45 + Math.random() * 0.85; // parallax layer
                const angle = Math.random() * Math.PI * 2;
                const speed = (0.14 + Math.random() * 0.28) * depth;
                particles[i] = {
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 0.08 * depth, // gentle upward float
                    baseVx: Math.cos(angle) * speed,
                    baseVy: Math.sin(angle) * speed - 0.08 * depth,
                    size: (5.5 + Math.random() * 7.5) * depth,
                    depth,
                    spriteIdx: i % sprites.length,
                    phase: Math.random() * Math.PI * 2,
                    twinkleSpeed: 0.014 + Math.random() * 0.022,
                    baseAlpha: 0.35 + Math.random() * 0.5,
                };
            }
        };

        const spawnMeteor = () => {
            if (meteors.length >= 2 || width < 480) return;
            const startX = width * (0.15 + Math.random() * 0.75);
            const startY = Math.random() * height * 0.35;
            const speed = 5.5 + Math.random() * 3.5;
            const angle = Math.PI * (0.18 + Math.random() * 0.14);
            meteors.push({
                x: startX,
                y: startY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                length: 65 + Math.random() * 55,
                life: 0,
                maxLife: 48 + Math.random() * 24,
                isGold: Math.random() > 0.45,
            });
        };

        // Pre-allocated bucket arrays for zero-GC batched line drawing
        const lineBuckets = [[], [], []];
        const bucketStyles = [
            'rgba(148, 163, 184, 0.07)',
            'rgba(96, 165, 250, 0.14)',
            'rgba(251, 191, 36, 0.22)',
        ];

        const renderFrame = (dtMs) => {
            const dt = Math.min(Math.max(dtMs / 16.667, 0.25), 2.2);
            ctx.clearRect(0, 0, width, height);

            if (pointer.active) {
                pointer.smoothX += (pointer.x - pointer.smoothX) * 0.18;
                pointer.smoothY += (pointer.y - pointer.smoothY) * 0.18;
            }

            const len = particles.length;
            const linkSq = linkDistance * linkDistance;
            const cursorSq = cursorRadius * cursorRadius;

            lineBuckets[0].length = 0;
            lineBuckets[1].length = 0;
            lineBuckets[2].length = 0;

            // Update positions & collect constellation links
            for (let i = 0; i < len; i++) {
                const p = particles[i];
                if (!prefersReducedMotion) {
                    p.phase += p.twinkleSpeed * dt;

                    // Gentle wave drift
                    p.vx += (p.baseVx + Math.sin(p.phase * 0.6) * 0.08 - p.vx) * 0.03 * dt;
                    p.vy += (p.baseVy - p.vy) * 0.03 * dt;

                    if (pointer.active) {
                        const dx = pointer.smoothX - p.x;
                        const dy = pointer.smoothY - p.y;
                        const dSq = dx * dx + dy * dy;
                        if (dSq < cursorSq && dSq > 4) {
                            const dist = Math.sqrt(dSq);
                            const force = (1 - dist / cursorRadius) * 0.035 * dt;
                            if (dist > 44) {
                                p.vx += (dx / dist) * force;
                                p.vy += (dy / dist) * force;
                            } else {
                                p.vx -= (dx / dist) * force * 1.4;
                                p.vy -= (dy / dist) * force * 1.4;
                            }
                        }
                    }

                    p.x += p.vx * dt;
                    p.y += p.vy * dt;

                    const pad = 20;
                    if (p.x < -pad) p.x = width + pad;
                    else if (p.x > width + pad) p.x = -pad;
                    if (p.y < -pad) p.y = height + pad;
                    else if (p.y > height + pad) p.y = -pad;
                }

                // Collect links to nearby particles (foreground/midground only for clean look)
                if (p.depth > 0.65) {
                    for (let j = i + 1; j < len; j++) {
                        const q = particles[j];
                        if (q.depth <= 0.65) continue;
                        const dx = p.x - q.x;
                        const dy = p.y - q.y;
                        const dSq = dx * dx + dy * dy;
                        if (dSq < linkSq) {
                            const ratio = 1 - dSq / linkSq;
                            const bIdx = ratio > 0.62 ? 2 : ratio > 0.3 ? 1 : 0;
                            lineBuckets[bIdx].push(p.x, p.y, q.x, q.y);
                        }
                    }
                }
            }

            // Draw batched constellation lines (only 3 stroke calls total!)
            ctx.lineWidth = 0.75;
            for (let b = 0; b < 3; b++) {
                const coords = lineBuckets[b];
                if (coords.length === 0) continue;
                ctx.beginPath();
                ctx.strokeStyle = bucketStyles[b];
                for (let k = 0; k < coords.length; k += 4) {
                    ctx.moveTo(coords[k], coords[k + 1]);
                    ctx.lineTo(coords[k + 2], coords[k + 3]);
                }
                ctx.stroke();
            }

            // Draw subtle cursor constellation threads & soft aura
            if (pointer.active && !prefersReducedMotion) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.24)';
                ctx.lineWidth = 0.85;
                for (let i = 0; i < len; i++) {
                    const p = particles[i];
                    const dx = pointer.smoothX - p.x;
                    const dy = pointer.smoothY - p.y;
                    if (dx * dx + dy * dy < cursorSq) {
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(pointer.smoothX, pointer.smoothY);
                    }
                }
                ctx.stroke();
            }

            // Draw pre-rendered luminous orb sprites (ultra-fast GPU blitting)
            for (let i = 0; i < len; i++) {
                const p = particles[i];
                const twinkle = 0.72 + Math.sin(p.phase) * 0.28;
                ctx.globalAlpha = Math.min(1, p.baseAlpha * twinkle);
                const half = p.size * 0.5;
                ctx.drawImage(sprites[p.spriteIdx], p.x - half, p.y - half, p.size, p.size);
            }
            ctx.globalAlpha = 1;

            // Occasional sleek shooting meteor streaks
            if (!prefersReducedMotion) {
                meteorCooldown -= dtMs;
                if (meteorCooldown <= 0) {
                    spawnMeteor();
                    meteorCooldown = 3600 + Math.random() * 4200;
                }

                for (let m = meteors.length - 1; m >= 0; m--) {
                    const met = meteors[m];
                    met.x += met.vx * dt;
                    met.y += met.vy * dt;
                    met.life += dt;

                    const progress = met.life / met.maxLife;
                    const alpha = progress < 0.25 ? progress * 4 : Math.max(0, 1 - (progress - 0.25) / 0.75);

                    const tailX = met.x - (met.vx / 6) * met.length;
                    const tailY = met.y - (met.vy / 6) * met.length;
                    const grad = ctx.createLinearGradient(met.x, met.y, tailX, tailY);
                    if (met.isGold) {
                        grad.addColorStop(0, `rgba(253, 224, 71, ${alpha * 0.85})`);
                        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
                    } else {
                        grad.addColorStop(0, `rgba(125, 211, 252, ${alpha * 0.85})`);
                        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
                    }

                    ctx.beginPath();
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 1.6;
                    ctx.moveTo(met.x, met.y);
                    ctx.lineTo(tailX, tailY);
                    ctx.stroke();

                    if (met.life >= met.maxLife) {
                        meteors.splice(m, 1);
                    }
                }
            }
        };

        const tick = (now) => {
            if (!isRunning) return;
            const dtMs = lastTime ? now - lastTime : 16.667;
            lastTime = now;
            renderFrame(dtMs);
            rafId = requestAnimationFrame(tick);
        };

        const startLoop = () => {
            if (prefersReducedMotion) {
                renderFrame(16.667);
                return;
            }
            if (!isRunning && isInViewport && isTabVisible) {
                isRunning = true;
                lastTime = 0;
                rafId = requestAnimationFrame(tick);
            }
        };

        const stopLoop = () => {
            isRunning = false;
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        };

        const syncLoop = () => {
            if (isInViewport && isTabVisible && !prefersReducedMotion) {
                startLoop();
            } else {
                stopLoop();
            }
        };

        const handlePointerMove = (e) => {
            if (!isInViewport || !isTabVisible) return;
            const x = e.clientX - rectLeft;
            const y = e.clientY - rectTop;
            if (x >= 0 && x <= width && y >= 0 && y <= height) {
                if (!pointer.active) {
                    pointer.smoothX = x;
                    pointer.smoothY = y;
                }
                pointer.x = x;
                pointer.y = y;
                pointer.active = true;
            } else {
                pointer.active = false;
            }
        };

        const handlePointerLeave = () => {
            pointer.active = false;
        };

        let scrollTicking = false;
        const handleScroll = () => {
            if (!isInViewport || scrollTicking) return;
            scrollTicking = true;
            requestAnimationFrame(() => {
                syncBounds();
                scrollTicking = false;
            });
        };

        let resizeTimer = null;
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                spawnParticles();
                renderFrame(16.667);
            }, 160);
        };

        const handleVisibility = () => {
            isTabVisible = !document.hidden;
            syncLoop();
        };

        spawnParticles();
        renderFrame(16.667);

        let observer = null;
        if (typeof IntersectionObserver !== 'undefined') {
            observer = new IntersectionObserver(
                ([entry]) => {
                    isInViewport = entry.isIntersecting;
                    if (isInViewport) syncBounds();
                    syncLoop();
                },
                { threshold: 0.01 }
            );
            observer.observe(canvas);
        }

        window.addEventListener('resize', handleResize, { passive: true });
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        window.addEventListener('pointerleave', handlePointerLeave, { passive: true });
        document.addEventListener('visibilitychange', handleVisibility);

        syncLoop();

        return () => {
            stopLoop();
            clearTimeout(resizeTimer);
            if (observer) observer.disconnect();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerleave', handlePointerLeave);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [linkDistance, cursorRadius]);

    return (
        <canvas
            ref={canvasRef}
            style={{ opacity, willChange: 'transform' }}
            className={`pointer-events-none select-none ${className}`}
            aria-hidden="true"
        />
    );
}

export default AuroraParticlesCanvas;
