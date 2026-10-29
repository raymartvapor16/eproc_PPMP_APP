import React, { useEffect, useRef } from 'react';

/**
 * SpiderParticlesCanvas
 * Renders an interactive constellation / spider-web particle mesh canvas.
 * Particles float smoothly and connect with luminous web threads when in proximity,
 * dynamically anchoring and weaving to the user's cursor.
 */
export const SpiderParticlesCanvas = ({
    className = 'absolute inset-0 pointer-events-none',
    particleCount,
    connectionDistance = 125,
    cursorRadius = 165,
}) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId;
        let width = 0;
        let height = 0;
        let dpr = window.devicePixelRatio || 1;
        let isVisible = true;

        // IntersectionObserver to pause loop when section is scrolled out of viewport
        let observer = null;
        if (typeof IntersectionObserver !== 'undefined') {
            observer = new IntersectionObserver(
                ([entry]) => {
                    isVisible = entry.isIntersecting;
                },
                { threshold: 0.02 }
            );
            observer.observe(canvas);
        }

        // Mouse tracking
        const mouse = {
            x: null,
            y: null,
            radius: cursorRadius,
            isActive: false,
        };

        // Provincial palette for spider nodes
        const colors = [
            { r: 255, g: 255, b: 255 }, // Crisp White
            { r: 56, g: 189, b: 248 },  // Sky Blue (500)
            { r: 125, g: 211, b: 252 }, // Light Sky (300)
            { r: 251, g: 191, b: 36 },  // Warm Amber
            { r: 45, g: 212, b: 191 },  // Vibrant Cyan
        ];

        class Particle {
            constructor(w, h) {
                this.x = Math.random() * w;
                this.y = Math.random() * h;
                this.radius = Math.random() * 1.8 + 1.2; // 1.2px to 3.0px
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.vx = (Math.random() - 0.5) * 0.65;
                this.vy = (Math.random() - 0.5) * 0.65;
                this.baseAlpha = Math.random() * 0.45 + 0.4; // 0.4 to 0.85
                this.alpha = this.baseAlpha;
                this.pulseSpeed = Math.random() * 0.015 + 0.008;
                this.pulseAngle = Math.random() * Math.PI * 2;
            }

            update(w, h) {
                // Gentle pulsing glow
                this.pulseAngle += this.pulseSpeed;
                this.alpha = this.baseAlpha + Math.sin(this.pulseAngle) * 0.18;

                // Move
                this.x += this.vx;
                this.y += this.vy;

                // Bounce off edges
                if (this.x < 0) {
                    this.x = 0;
                    this.vx *= -1;
                } else if (this.x > w) {
                    this.x = w;
                    this.vx *= -1;
                }

                if (this.y < 0) {
                    this.y = 0;
                    this.vy *= -1;
                } else if (this.y > h) {
                    this.y = h;
                    this.vy *= -1;
                }

                // Interactive cursor elasticity (spider web pull)
                if (mouse.isActive && mouse.x !== null && mouse.y !== null) {
                    const dx = mouse.x - this.x;
                    const dy = mouse.y - this.y;
                    const distance = Math.hypot(dx, dy);

                    if (distance < mouse.radius) {
                        const forceDirectionX = dx / distance;
                        const forceDirectionY = dy / distance;
                        const maxDistance = mouse.radius;
                        const force = (maxDistance - distance) / maxDistance;
                        const directionX = forceDirectionX * force * 0.4;
                        const directionY = forceDirectionY * force * 0.4;

                        this.x += directionX;
                        this.y += directionY;
                    }
                }
            }

            draw(context) {
                context.save();
                context.beginPath();
                context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                context.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${Math.max(0.1, this.alpha)})`;
                context.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.8)`;
                context.shadowBlur = 6;
                context.fill();
                context.restore();
            }
        }

        let particles = [];

        const initParticles = (w, h) => {
            const count = particleCount || Math.min(85, Math.max(35, Math.floor((w * h) / 18000)));
            particles = [];
            for (let i = 0; i < count; i++) {
                particles.push(new Particle(w, h));
            }
        };

        const handleResize = () => {
            if (!canvas.parentElement) return;
            const rect = canvas.parentElement.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            dpr = window.devicePixelRatio || 1;

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            ctx.scale(dpr, dpr);
            initParticles(width, height);
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        // Global mouse listeners on window so interaction works through overlay content
        const handleMouseMove = (e) => {
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const clientX = e.clientX;
            const clientY = e.clientY;

            // Check if mouse is within vertical bounds of canvas with padding
            if (
                clientX >= rect.left &&
                clientX <= rect.right &&
                clientY >= rect.top &&
                clientY <= rect.bottom
            ) {
                mouse.x = clientX - rect.left;
                mouse.y = clientY - rect.top;
                mouse.isActive = true;
            } else {
                mouse.isActive = false;
            }
        };

        const handleMouseLeave = () => {
            mouse.isActive = false;
        };

        const handleTouchMove = (e) => {
            if (!canvas || !e.touches || e.touches.length === 0) return;
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            if (
                touch.clientX >= rect.left &&
                touch.clientX <= rect.right &&
                touch.clientY >= rect.top &&
                touch.clientY <= rect.bottom
            ) {
                mouse.x = touch.clientX - rect.left;
                mouse.y = touch.clientY - rect.top;
                mouse.isActive = true;
            } else {
                mouse.isActive = false;
            }
        };

        const handleTouchEnd = () => {
            mouse.isActive = false;
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('touchend', handleTouchEnd);

        // Render Loop
        const animate = () => {
            if (!isVisible) {
                animationFrameId = requestAnimationFrame(animate);
                return;
            }

            ctx.clearRect(0, 0, width, height);

            // Connect nearby particles (spider web threads)
            for (let a = 0; a < particles.length; a++) {
                for (let b = a + 1; b < particles.length; b++) {
                    const dx = particles[a].x - particles[b].x;
                    const dy = particles[a].y - particles[b].y;
                    const dist = Math.hypot(dx, dy);

                    if (dist < connectionDistance) {
                        const opacity = (1 - dist / connectionDistance) * 0.38;
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.strokeStyle = `rgba(148, 197, 240, ${opacity})`;
                        ctx.lineWidth = 0.85;
                        ctx.stroke();
                    }
                }
            }

            // Connect cursor to nearby particles (interactive web anchor)
            if (mouse.isActive && mouse.x !== null && mouse.y !== null) {
                for (let i = 0; i < particles.length; i++) {
                    const dx = mouse.x - particles[i].x;
                    const dy = mouse.y - particles[i].y;
                    const dist = Math.hypot(dx, dy);

                    if (dist < mouse.radius) {
                        const opacity = (1 - dist / mouse.radius) * 0.65;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(mouse.x, mouse.y);
                        // Subtle gold/cyan hybrid web thread connecting to cursor
                        ctx.strokeStyle = `rgba(186, 230, 253, ${opacity})`;
                        ctx.lineWidth = 1.1;
                        ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
                        ctx.shadowBlur = 4;
                        ctx.stroke();
                        ctx.shadowBlur = 0; // reset
                    }
                }

                // Cursor center particle beacon
                ctx.save();
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
                ctx.shadowColor = 'rgba(251, 191, 36, 0.9)';
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.restore();
            }

            // Update & draw particles
            for (let i = 0; i < particles.length; i++) {
                particles[i].update(width, height);
                particles[i].draw(ctx);
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
            if (observer) {
                observer.disconnect();
            }
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [particleCount, connectionDistance, cursorRadius]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ display: 'block' }}
            aria-hidden="true"
        />
    );
};

