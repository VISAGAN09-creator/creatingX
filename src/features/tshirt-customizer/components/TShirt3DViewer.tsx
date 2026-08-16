/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { PanelId, CustomizerState, TShirtColor, DesignSizeType } from '../types';
import { RotateCw, Move, RefreshCw } from 'lucide-react';

interface TShirt3DViewerProps {
    state: CustomizerState;
    onChangeState: (updater: (prev: CustomizerState) => CustomizerState) => void;
    is3dShowcase: boolean;
    setIs3dShowcase: (val: boolean) => void;
}

export const TShirt3DViewer: React.FC<TShirt3DViewerProps> = ({
    state,
    onChangeState,
    is3dShowcase,
    setIs3dShowcase,
}) => {
    const { color, activePanel, designs, garmentSize, style, finish } = state;
    const activeDesign = designs[activePanel];

    // Drag and drop states on the flat editor
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, initialX: 50, initialY: 50 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Rotation and slider interactions on-mockup
    const [isRotating, setIsRotating] = useState(false);
    const rotateStartRef = useRef({ startAngle: 0, initialRotation: 0 });

    // Auto-rotation angle for 3D showcase
    const [autoRotateAngle, setAutoRotateAngle] = useState(0);
    const [isAutoSpinning, setIsAutoSpinning] = useState(true);
    const animationFrameRef = useRef<number | null>(null);

    // Auto-rotation effect for 3D Showroom
    useEffect(() => {
        if (is3dShowcase && isAutoSpinning) {
            const updateAngle = () => {
                setAutoRotateAngle((prev) => (prev + 0.5) % 360);
                animationFrameRef.current = requestAnimationFrame(updateAngle);
            };
            animationFrameRef.current = requestAnimationFrame(updateAngle);
        } else {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        }
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [is3dShowcase, isAutoSpinning]);

    // Map sizeType to actual dimensions (percentages of printable area)
    const getSizeMultiplier = (sizeType: DesignSizeType) => {
        switch (sizeType) {
            case 'small':
                return 0.45;
            case 'large':
                return 0.95;
            case 'medium':
            default:
                return 0.70;
        }
    };

    // Convert Color IDs to CSS classes/colors
    const getGarmentColorHex = (c: TShirtColor) => {
        switch (c) {
            case 'black': return '#121214';
            case 'red': return '#d91d2a';
            case 'white':
            default: return '#f5f5f7';
        }
    };

    // Drag handlers
    const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (!activeDesign.url) return;

        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        dragStartRef.current = {
            x: clientX,
            y: clientY,
            initialX: activeDesign.x,
            initialY: activeDesign.y,
        };
    };

    const handleDragMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - dragStartRef.current.x;
        const deltaY = clientY - dragStartRef.current.y;

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();

            // Calculate delta as percentage of container width & height
            const percentDeltaX = (deltaX / rect.width) * 100;
            const percentDeltaY = (deltaY / rect.height) * 100;

            let newX = dragStartRef.current.initialX + percentDeltaX;
            let newY = dragStartRef.current.initialY + percentDeltaY;

            // Clamp so design stays within comfortable bounds
            newX = Math.max(10, Math.min(90, newX));
            newY = Math.max(15, Math.min(85, newY));

            onChangeState((prev) => {
                const nextDesigns = { ...prev.designs };
                nextDesigns[activePanel] = {
                    ...nextDesigns[activePanel],
                    x: Math.round(newX),
                    y: Math.round(newY),
                };
                return { ...prev, designs: nextDesigns };
            });
        }
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    // Rotation Dial Drag Handlers (on-image knob)
    const handleRotateStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        if (!activeDesign.url || !containerRef.current) return;

        setIsRotating(true);
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        // Angle from center
        const startAngle = Math.atan2(clientY - centerY, clientX - centerX);

        rotateStartRef.current = {
            startAngle,
            initialRotation: activeDesign.rotation,
        };
    };

    const handleRotateMove = (e: MouseEvent | TouchEvent) => {
        if (!isRotating || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const currentAngle = Math.atan2(clientY - centerY, clientX - centerX);
        const angleDiffRad = currentAngle - rotateStartRef.current.startAngle;
        const angleDiffDeg = (angleDiffRad * 180) / Math.PI;

        let newRotation = (rotateStartRef.current.initialRotation + angleDiffDeg) % 360;
        if (newRotation < 0) newRotation += 360;

        onChangeState((prev) => {
            const nextDesigns = { ...prev.designs };
            nextDesigns[activePanel] = {
                ...nextDesigns[activePanel],
                rotation: Math.round(newRotation),
            };
            return { ...prev, designs: nextDesigns };
        });
    };

    const handleRotateEnd = () => {
        setIsRotating(false);
    };

    // Register global event listeners for smooth drag & rotate
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleDragMove, { passive: false });
            window.addEventListener('touchend', handleDragEnd);
        }
        if (isRotating) {
            window.addEventListener('mousemove', handleRotateMove);
            window.addEventListener('mouseup', handleRotateEnd);
            window.addEventListener('touchmove', handleRotateMove, { passive: false });
            window.addEventListener('touchend', handleRotateEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);
            window.removeEventListener('mousemove', handleRotateMove);
            window.removeEventListener('mouseup', handleRotateEnd);
            window.removeEventListener('touchmove', handleRotateMove);
            window.removeEventListener('touchend', handleRotateEnd);
        };
    }, [isDragging, isRotating]);

    // Helper to render high-fidelity T-shirt garment with folds and shading
    const renderGarmentSvg = (panel: PanelId, size: number = 420) => {
        const shirtColor = getGarmentColorHex(color);

        // Custom shading styles based on shirt color to maximize realism
        const multiplyOpacity = color === 'white' ? 0.22 : color === 'red' ? 0.38 : 0.15;
        const screenOpacity = color === 'black' ? 0.55 : color === 'red' ? 0.32 : 0.18;

        const isBack = panel === 'back';
        const isSleeve = panel === 'leftSleeve' || panel === 'rightSleeve';

        if (isSleeve) {
            // Sleeve Detail View SVG
            return (
                <svg viewBox="0 0 400 400" width={size} height={size} className="drop-shadow-2xl transition-all duration-500">
                    <defs>
                        {/* Shading Gradients */}
                        <linearGradient id="sleeveShade" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#000000" stopOpacity="0.5" />
                            <stop offset="25%" stopColor="#000000" stopOpacity="0.1" />
                            <stop offset="85%" stopColor="#000000" stopOpacity="0.0" />
                            <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
                        </linearGradient>
                        <linearGradient id="sleeveHighlight" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.0" />
                            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                        </linearGradient>
                        <filter id="acidWashSleeve" x="0" y="0" width="100%" height="100%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
                            <feColorMatrix type="matrix" values="0.1 0 0 0 0.5   0.1 0 0 0 0.5   0.1 0 0 0 0.5  0 0 0 0.25 0" />
                            <feBlend mode="color-dodge" in="SourceGraphic" in2="noise" />
                        </filter>
                    </defs>

                    {/* Sleeve Fabric Base */}
                    <path
                        d="M 50 100 Q 150 50 250 100 L 320 280 Q 200 320 80 280 Z"
                        fill={shirtColor}
                        stroke="#000000"
                        strokeWidth="1.5"
                        strokeOpacity="0.1"
                        filter={finish === 'acid wash' ? 'url(#acidWashSleeve)' : undefined}
                    />

                    {/* Stitching lines at sleeve hem */}
                    <path
                        d="M 85 270 Q 200 310 315 270"
                        fill="none"
                        stroke={color === 'black' ? '#444' : '#ccc'}
                        strokeWidth="1"
                        strokeDasharray="4,3"
                    />
                    <path
                        d="M 87 274 Q 200 314 313 274"
                        fill="none"
                        stroke={color === 'black' ? '#333' : '#ddd'}
                        strokeWidth="1"
                        strokeDasharray="4,3"
                    />

                    {/* Realistic folds & curves overlays */}
                    {/* Shadow Overlay */}
                    <path
                        d="M 50 100 Q 150 50 250 100 L 320 280 Q 200 320 80 280 Z"
                        fill="url(#sleeveShade)"
                        style={{ mixBlendMode: 'multiply' }}
                        opacity={multiplyOpacity * 1.5}
                    />
                    {/* Highlights Overlay */}
                    <path
                        d="M 50 100 Q 150 50 250 100 L 320 280 Q 200 320 80 280 Z"
                        fill="url(#sleeveHighlight)"
                        style={{ mixBlendMode: 'screen' }}
                        opacity={screenOpacity}
                    />

                    {/* Shoulder seam edge shadow */}
                    <path
                        d="M 50 100 Q 150 50 250 100"
                        fill="none"
                        stroke="#000"
                        strokeWidth="6"
                        opacity="0.15"
                    />
                </svg>
            );
        }

        // Front / Back Full Body SVG
        return (
            <svg viewBox="0 0 500 500" width={size} height={size} className="drop-shadow-2xl transition-all duration-500">
                <defs>
                    {/* Filter for subtle fabric blur */}
                    <filter id="creaseBlur" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" />
                    </filter>

                    {/* Neck depth inner shadow */}
                    <radialGradient id="neckInnerShadow" cx="50%" cy="15%" r="40%">
                        <stop offset="0%" stopColor="#000000" stopOpacity="0.75" />
                        <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
                    </radialGradient>

                    {/* General body 3D volume shading */}
                    <linearGradient id="bodyShade" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#000000" stopOpacity="0.35" />
                        <stop offset="12%" stopColor="#000000" stopOpacity="0.1" />
                        <stop offset="30%" stopColor="#000000" stopOpacity="0.0" />
                        <stop offset="50%" stopColor="#ffffff" stopOpacity="0.15" />
                        <stop offset="70%" stopColor="#000000" stopOpacity="0.0" />
                        <stop offset="88%" stopColor="#000000" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#000000" stopOpacity="0.38" />
                    </linearGradient>

                    {/* Vertical volume shading */}
                    <linearGradient id="verticalShade" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#000000" stopOpacity="0.2" />
                        <stop offset="12%" stopColor="#000000" stopOpacity="0.0" />
                        <stop offset="85%" stopColor="#000000" stopOpacity="0.0" />
                        <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
                    </linearGradient>

                    {/* Fabric Highlight overlay */}
                    <linearGradient id="bodyHighlight" x1="0%" y1="0%" x2="50%" y2="0%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.0" />
                        <stop offset="80%" stopColor="#ffffff" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="acidWashBody" x="0" y="0" width="100%" height="100%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
                        <feColorMatrix type="matrix" values="0.1 0 0 0 0.5   0.1 0 0 0 0.5   0.1 0 0 0 0.5  0 0 0 0.25 0" />
                        <feBlend mode="color-dodge" in="SourceGraphic" in2="noise" />
                    </filter>
                </defs>

                {/* 1. INNER COLLAR DEPTH (Only visible from front) */}
                {!isBack && style !== 'polo' && (
                    <path
                        d="M 175,98 Q 250,140 325,98 Q 250,75 175,98 Z"
                        fill="#0c0c0e"
                    />
                )}
                {!isBack && style !== 'polo' && (
                    <path
                        d="M 175,98 Q 250,140 325,98 Q 250,75 175,98 Z"
                        fill="url(#neckInnerShadow)"
                        opacity="0.9"
                    />
                )}

                {/* Brand label detail visible in inner collar */}
                {!isBack && style !== 'polo' && (
                    <g transform="translate(250, 105)" opacity="0.35">
                        <text fontFamily="monospace" fontSize="7" fill="#888" textAnchor="middle" letterSpacing="2">VARATAAA</text>
                        <text y="7" fontFamily="sans-serif" fontSize="5" fill="#555" textAnchor="middle" fontWeight="bold">PREMIUM TEE • {garmentSize}</text>
                    </g>
                )}

                {/* 2. MAIN T-SHIRT OUTLINE */}
                <path
                    id="tshirt-main-path"
                    d="M 175,98 
             Q 135,110 95,130 
             L 60,195 
             L 105,230 
             L 145,210 
             L 135,445 
             Q 250,455 365,445 
             L 355,210 
             L 395,230 
             L 440,195 
             L 405,130 
             Q 365,110 325,98
             Q 250,122 175,98 Z"
                    fill={shirtColor}
                    stroke="#000000"
                    strokeWidth="1.5"
                    strokeOpacity="0.08"
                    filter={finish === 'acid wash' ? 'url(#acidWashBody)' : undefined}
                />

                {/* 3. SHADING OVERLAYS */}
                {/* Multiplying shadows (depth, folds) */}
                <path
                    d="M 175,98 Q 135,110 95,130 L 60,195 L 105,230 L 145,210 L 135,445 Q 250,455 365,445 L 355,210 L 395,230 L 440,195 L 405,130 Q 365,110 325,98 Q 250,122 175,98 Z"
                    fill="url(#bodyShade)"
                    style={{ mixBlendMode: 'multiply' }}
                    opacity={multiplyOpacity}
                />
                <path
                    d="M 175,98 Q 135,110 95,130 L 60,195 L 105,230 L 145,210 L 135,445 Q 250,455 365,445 L 355,210 L 395,230 L 440,195 L 405,130 Q 365,110 325,98 Q 250,122 175,98 Z"
                    fill="url(#verticalShade)"
                    style={{ mixBlendMode: 'multiply' }}
                    opacity={multiplyOpacity * 1.3}
                />

                {/* Screening highlights (volume) */}
                <path
                    d="M 175,98 Q 135,110 95,130 L 60,195 L 105,230 L 145,210 L 135,445 Q 250,455 365,445 L 355,210 L 395,230 L 440,195 L 405,130 Q 365,110 325,98 Q 250,122 175,98 Z"
                    fill="url(#bodyHighlight)"
                    style={{ mixBlendMode: 'screen' }}
                    opacity={screenOpacity}
                />

                {/* 4. SEAM & FOLD DETAIL PATHS (Vector Creases) */}
                <g opacity="0.12" style={{ mixBlendMode: 'multiply' }}>
                    {/* Armpit fold lines */}
                    <path d="M 145,210 C 160,240 180,250 200,255" fill="none" stroke="#000000" strokeWidth="2.5" filter="url(#creaseBlur)" />
                    <path d="M 355,210 C 340,240 320,250 300,255" fill="none" stroke="#000000" strokeWidth="2.5" filter="url(#creaseBlur)" />

                    {/* Chest soft creases */}
                    <path d="M 180,180 C 210,210 250,210 270,200" fill="none" stroke="#000000" strokeWidth="2" filter="url(#creaseBlur)" />
                    <path d="M 310,170 C 280,190 260,190 240,185" fill="none" stroke="#000000" strokeWidth="2.5" filter="url(#creaseBlur)" />

                    {/* Waist soft folds */}
                    <path d="M 138,320 C 160,330 190,325 210,315" fill="none" stroke="#000000" strokeWidth="3" filter="url(#creaseBlur)" />
                    <path d="M 362,350 C 340,360 310,355 290,345" fill="none" stroke="#000000" strokeWidth="2.5" filter="url(#creaseBlur)" />
                </g>

                {/* 5. COLLAR OVERLAY & RIBBING SEAMS */}
                {style === 'polo' ? (
                    // Polo collar style
                    isBack ? (
                        // Back polo collar
                        <path
                            d="M 170,98 Q 250,118 330,98 L 320,80 Q 250,96 180,80 Z"
                            fill={shirtColor}
                            stroke="#000000"
                            strokeWidth="1.2"
                            filter={finish === 'acid wash' ? 'url(#acidWashBody)' : undefined}
                        />
                    ) : (
                        // Front polo collar placket & flaps
                        <g>
                            {/* Placket neck gap opening */}
                            <path d="M 242,108 L 250,124 L 258,108 Z" fill="#1c1c1e" />

                            {/* Vertical Button Placket */}
                            <path
                                d="M 243,108 L 243,165 L 257,165 L 257,108 Z"
                                fill={shirtColor}
                                stroke="#000000"
                                strokeWidth="1"
                                filter={finish === 'acid wash' ? 'url(#acidWashBody)' : undefined}
                            />

                            {/* Placket double stitching */}
                            <line x1="245" y1="112" x2="245" y2="161" stroke={color === 'black' ? '#3a3a3d' : '#bbbbbb'} strokeWidth="0.6" strokeDasharray="2,1" />
                            <line x1="255" y1="112" x2="255" y2="161" stroke={color === 'black' ? '#3a3a3d' : '#bbbbbb'} strokeWidth="0.6" strokeDasharray="2,1" />

                            {/* Buttons */}
                            <circle cx="250" cy="126" r="2.5" fill="#f5f5f7" stroke="#000000" strokeWidth="0.8" />
                            <circle cx="250" cy="126" r="0.6" fill="#000000" />
                            <circle cx="250" cy="146" r="2.5" fill="#f5f5f7" stroke="#000000" strokeWidth="0.8" />
                            <circle cx="250" cy="146" r="0.6" fill="#000000" />

                            {/* Left collar leaf/flap */}
                            <path
                                d="M 172,98 Q 210,120 248,118 L 208,148 L 172,98 Z"
                                fill={shirtColor}
                                stroke="#000000"
                                strokeWidth="1.2"
                                filter={finish === 'acid wash' ? 'url(#acidWashBody)' : undefined}
                            />

                            {/* Right collar leaf/flap */}
                            <path
                                d="M 328,98 Q 290,120 252,118 L 292,148 L 328,98 Z"
                                fill={shirtColor}
                                stroke="#000000"
                                strokeWidth="1.2"
                                filter={finish === 'acid wash' ? 'url(#acidWashBody)' : undefined}
                            />
                        </g>
                    )
                ) : (
                    // Crew neck ribbing
                    <>
                        {isBack ? (
                            <path
                                d="M 175,98 Q 250,118 325,98 Q 250,82 175,98 Z"
                                fill={shirtColor}
                                stroke="#000"
                                strokeWidth="1"
                                strokeOpacity="0.15"
                            />
                        ) : (
                            <path
                                d="M 175,98 Q 250,122 325,98 Q 250,78 175,98 Z"
                                fill="none"
                                stroke={color === 'black' ? '#2d2d30' : '#d2d2d6'}
                                strokeWidth="4"
                                opacity="0.9"
                            />
                        )}

                        {!isBack && (
                            <>
                                <path d="M 172,94 Q 250,118 328,94" fill="none" stroke={color === 'black' ? '#3e3e42' : '#e5e5eb'} strokeWidth="0.8" strokeDasharray="3,2" />
                                <path d="M 175,102 Q 250,126 325,102" fill="none" stroke={color === 'black' ? '#2c2c2f' : '#cccccc'} strokeWidth="0.8" strokeDasharray="3,2" />
                            </>
                        )}
                    </>
                )}

                {/* Sleeve stitching seams */}
                <path d="M 98,133 Q 120,170 145,210" fill="none" stroke="#000" strokeWidth="1" opacity="0.08" />
                <path d="M 402,133 Q 380,170 355,210" fill="none" stroke="#000" strokeWidth="1" opacity="0.08" />

                {/* Sleeve cuff hem stitching */}
                <path d="M 64,191 L 102,223" fill="none" stroke={color === 'black' ? '#3a3a3d' : '#cccccc'} strokeWidth="1" strokeDasharray="3,2" />
                <path d="M 436,191 L 398,223" fill="none" stroke={color === 'black' ? '#3a3a3d' : '#cccccc'} strokeWidth="1" strokeDasharray="3,2" />

                {/* Bottom hem stitching */}
                <path d="M 137,437 Q 250,447 363,437" fill="none" stroke={color === 'black' ? '#3a3a3d' : '#cccccc'} strokeWidth="1.2" strokeDasharray="4,2" />
                <path d="M 136,441 Q 250,451 364,441" fill="none" stroke={color === 'black' ? '#28282a' : '#d8d8dd'} strokeWidth="1" strokeDasharray="4,2" />
            </svg>
        );
    };

    // Coordinates translation for Design Printable Overlay
    const getPanelOverlayDimensions = (panel: PanelId) => {
        switch (panel) {
            case 'leftSleeve':
            case 'rightSleeve':
                return {
                    width: 180,
                    height: 180,
                    top: '32%',
                    left: '27.5%',
                    label: 'Sleeve Printable Area (8" x 8")',
                };
            case 'back':
                return {
                    width: 160,
                    height: 250,
                    top: '25%',
                    left: '35%',
                    label: 'Back Printable Area (12" x 18")',
                };
            case 'extra':
                return {
                    width: 160,
                    height: 250,
                    top: '26%',
                    left: '35%',
                    label: 'Front Printable Area (Extra) (12" x 18")',
                };
            case 'front':
            default:
                return {
                    width: 160,
                    height: 250,
                    top: '26%',
                    left: '35%',
                    label: 'Front Printable Area (12" x 18")',
                };
        }
    };

    const overlayDim = getPanelOverlayDimensions(activePanel);

    // Quick preset sizes
    const handleSizeClick = (sizeType: DesignSizeType) => {
        onChangeState((prev) => {
            const nextDesigns = { ...prev.designs };
            nextDesigns[activePanel] = {
                ...nextDesigns[activePanel],
                sizeType,
            };
            return { ...prev, designs: nextDesigns };
        });
    };

    // Reset active design position
    const handleResetPosition = () => {
        onChangeState((prev) => {
            const nextDesigns = { ...prev.designs };
            nextDesigns[activePanel] = {
                ...nextDesigns[activePanel],
                x: 50,
                y: 50,
                rotation: 0,
            };
            return { ...prev, designs: nextDesigns };
        });
    };

    const sizeMultiplier = getSizeMultiplier(activeDesign.sizeType);

    return (
        <div className="flex flex-col items-center justify-between h-full w-full">

            {/* Visual Controls / Showroom Toggle Header */}
            <div className="w-full flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-black animate-pulse"></span>
                    <span className="text-xs font-mono text-metal-dark uppercase tracking-widest font-semibold">
                        {is3dShowcase ? '3D Live Showroom' : `${activePanel === 'extra' ? 'extra front' : activePanel} View Editor`}
                    </span>
                </div>

                {/* View Mode Switcher */}
                <div className="bg-metal-light border border-metal-mid p-0.5 rounded-lg flex gap-1">
                    <button
                        id="editor-mode-btn"
                        onClick={() => setIs3dShowcase(false)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${!is3dShowcase
                                ? 'bg-black text-white shadow-sm font-semibold'
                                : 'text-metal-dark hover:text-black'
                            }`}
                    >
                        🎯 Precision Editor
                    </button>
                    <button
                        id="showroom-mode-btn"
                        onClick={() => setIs3dShowcase(true)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${is3dShowcase
                                ? 'bg-black text-white shadow-sm font-semibold'
                                : 'text-metal-dark hover:text-black'
                            }`}
                    >
                        🛰️ 3D Showroom
                    </button>
                </div>
            </div>

            {/* Main Preview Container */}
            <div className="relative flex-1 w-full min-h-[420px] sm:min-h-[460px] flex items-center justify-center bg-[radial-gradient(circle_at_center,_#ffffff_0%,_#f3f4f6_100%)] rounded-2xl border border-metal-mid p-4 sm:p-6 overflow-hidden select-none shadow-sm">

                {/* Technical background grids */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full border border-metal-mid/40 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border border-metal-mid/20 pointer-events-none" />

                {!is3dShowcase ? (
                    /* ================= PRECISION EDITOR MODE ================= */
                    <div className="relative flex items-center justify-center w-full max-w-[420px] aspect-square transition-all duration-500">

                        {/* The high-fidelity garment background */}
                        <div className="pointer-events-none z-0">
                            {renderGarmentSvg(activePanel === 'extra' ? 'front' : activePanel)}
                        </div>

                        {/* Interactive Design Area Overlay */}
                        <div
                            id="printable-bounds-area"
                            className="absolute border border-dashed border-neutral-400/70 hover:border-black rounded transition-colors group"
                            style={{
                                width: overlayDim.width,
                                height: overlayDim.height,
                                top: overlayDim.top,
                                left: overlayDim.left,
                            }}
                        >
                            {/* Printable Area Helper Badge */}
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-[10px] text-white px-2 py-0.5 rounded font-mono whitespace-nowrap z-30 shadow-md">
                                {overlayDim.label}
                            </div>

                            {/* Bound Container for dragging */}
                            <div
                                ref={containerRef}
                                className="relative w-full h-full"
                            >
                                {/* Passive Front Design preview when editing Extra */}
                                {activePanel === 'extra' && designs.front.url && (
                                    <div
                                        className="absolute pointer-events-none origin-center select-none opacity-45"
                                        style={{
                                            left: `${designs.front.x}%`,
                                            top: `${designs.front.y}%`,
                                            transform: `translate(-50%, -50%) rotate(${designs.front.rotation}deg)`,
                                            width: `${getSizeMultiplier(designs.front.sizeType) * 100}%`,
                                            height: 'auto',
                                            aspectRatio: '1',
                                            zIndex: 5,
                                        }}
                                    >
                                        <img
                                            src={designs.front.url}
                                            alt="Front passive preview"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                )}

                                {/* Passive Extra Design preview when editing Front */}
                                {activePanel === 'front' && designs.extra?.url && (
                                    <div
                                        className="absolute pointer-events-none origin-center select-none opacity-45"
                                        style={{
                                            left: `${designs.extra.x}%`,
                                            top: `${designs.extra.y}%`,
                                            transform: `translate(-50%, -50%) rotate(${designs.extra.rotation}deg)`,
                                            width: `${getSizeMultiplier(designs.extra.sizeType) * 100}%`,
                                            height: 'auto',
                                            aspectRatio: '1',
                                            zIndex: 5,
                                        }}
                                    >
                                        <img
                                            src={designs.extra.url}
                                            alt="Extra passive preview"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                )}

                                {activeDesign.url ? (
                                    /* Floating design with drag, rotate and resize boundaries */
                                    <div
                                        id={`active-design-box-${activePanel}`}
                                        onMouseDown={handleDragStart}
                                        onTouchStart={handleDragStart}
                                        className={`absolute cursor-move group/design select-none origin-center ${isDragging ? 'ring-2 ring-black ring-offset-2 ring-offset-white scale-[1.02]' : ''
                                            }`}
                                        style={{
                                            left: `${activeDesign.x}%`,
                                            top: `${activeDesign.y}%`,
                                            transform: `translate(-50%, -50%) rotate(${activeDesign.rotation}deg)`,
                                            width: `${sizeMultiplier * 100}%`,
                                            height: 'auto',
                                            aspectRatio: '1',
                                            zIndex: 10,
                                        }}
                                    >
                                        {/* Bounding Box Highlights */}
                                        <div className="absolute -inset-1 border border-dashed border-metal-dark group-hover/design:border-black rounded opacity-60 group-hover/design:opacity-100 transition-all pointer-events-none" />

                                        {/* Drag Handle Help Label */}
                                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-[10px] text-white px-2 py-0.5 rounded shadow-md font-mono flex items-center gap-1 opacity-0 group-hover/design:opacity-100 transition-all pointer-events-none whitespace-nowrap z-40">
                                            <Move className="w-3 h-3 text-neutral-300" />
                                            Drag to move
                                        </div>

                                        {/* Actual Uploaded Design Rendering */}
                                        <img
                                            src={activeDesign.url}
                                            alt={`${activePanel} Print`}
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-contain pointer-events-none"
                                        />

                                        {/* Interactive Rotation Dial Knob (Top Center Anchor) */}
                                        <div
                                            onMouseDown={handleRotateStart}
                                            onTouchStart={handleRotateStart}
                                            className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-black hover:bg-neutral-800 border border-white text-white flex items-center justify-center cursor-alias shadow-lg scale-0 group-hover/design:scale-100 transition-transform active:scale-110 z-50"
                                            title="Drag around to rotate"
                                        >
                                            <RotateCw className="w-3.5 h-3.5" />
                                        </div>

                                        {/* Info badge showing rotation angle when rotated */}
                                        {activeDesign.rotation > 0 && (
                                            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-black text-[10px] text-white px-1.5 py-0.5 rounded font-mono pointer-events-none shadow-md">
                                                {activeDesign.rotation}°
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Empty state for printable area */
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center opacity-50 group-hover:opacity-90 transition-opacity">
                                        <div className="w-9 h-9 rounded-full border border-dashed border-metal-dark flex items-center justify-center mb-1.5">
                                            <span className="text-black text-sm font-bold">+</span>
                                        </div>
                                        <span className="text-[11px] font-mono text-metal-dark font-medium">
                                            {activePanel === 'front' || activePanel === 'back'
                                                ? 'Compulsory printable area'
                                                : 'Optional printable area'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick helper controls docked at the bottom of editor frame */}
                        {activeDesign.url && (
                            <div className="absolute bottom-1 bg-white/95 border border-metal-mid backdrop-blur-md rounded-xl p-1.5 flex gap-2 shadow-sm z-20">
                                <button
                                    onClick={handleResetPosition}
                                    className="p-1 px-2.5 rounded text-[10px] font-mono text-metal-dark hover:text-black hover:bg-metal-light transition-all flex items-center gap-1 cursor-pointer"
                                    title="Reset Position"
                                >
                                    <RefreshCw className="w-3 h-3 text-metal-dark" /> Reset Position
                                </button>
                                <div className="w-[1px] bg-metal-mid" />
                                <div className="flex gap-1">
                                    {(['small', 'medium', 'large'] as DesignSizeType[]).map((sz) => (
                                        <button
                                            key={sz}
                                            onClick={() => handleSizeClick(sz)}
                                            className={`text-[9px] px-2 py-0.5 rounded font-mono uppercase transition-all cursor-pointer ${activeDesign.sizeType === sz
                                                    ? 'bg-black text-white font-bold'
                                                    : 'text-metal-dark hover:text-black hover:bg-metal-light'
                                                }`}
                                        >
                                            {sz[0]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ================= 3D SHOWROOM MODE ================= */
                    <div className="relative w-full h-[380px] flex items-center justify-center">

                        {/* Real 3D viewport containing revolving perspectives */}
                        <div
                            className="relative w-[340px] h-[340px] flex items-center justify-center transition-all duration-700"
                            style={{
                                perspective: '1200px',
                                transformStyle: 'preserve-3d',
                            }}
                        >
                            {/* Revolving stage */}
                            <div
                                id="showroom-3d-stage"
                                className="relative w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
                                style={{
                                    transform: `rotateY(${autoRotateAngle}deg)`,
                                    transformStyle: 'preserve-3d',
                                }}
                            >

                                {/* 1. FRONT PANEL CARD */}
                                <div
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{
                                        transform: 'translateZ(15px)',
                                        transformStyle: 'preserve-3d',
                                        backfaceVisibility: 'hidden',
                                    }}
                                >
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        {renderGarmentSvg('front', 330)}

                                        {/* Front Design Overlay */}
                                        {designs.front.url && (
                                            <div
                                                className="absolute pointer-events-none origin-center"
                                                style={{
                                                    width: getPanelOverlayDimensions('front').width * 0.78,
                                                    height: getPanelOverlayDimensions('front').height * 0.78,
                                                    top: '26.5%',
                                                    left: '35%',
                                                    transformStyle: 'preserve-3d',
                                                }}
                                            >
                                                <img
                                                    src={designs.front.url}
                                                    alt="Front overlay"
                                                    referrerPolicy="no-referrer"
                                                    className="absolute object-contain"
                                                    style={{
                                                        left: `${designs.front.x}%`,
                                                        top: `${designs.front.y}%`,
                                                        transform: `translate(-50%, -50%) rotate(${designs.front.rotation}deg)`,
                                                        width: `${getSizeMultiplier(designs.front.sizeType) * 100}%`,
                                                        height: 'auto',
                                                        aspectRatio: '1',
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {/* Extra Design Overlay */}
                                        {designs.extra?.url && (
                                            <div
                                                className="absolute pointer-events-none origin-center"
                                                style={{
                                                    width: getPanelOverlayDimensions('extra').width * 0.78,
                                                    height: getPanelOverlayDimensions('extra').height * 0.78,
                                                    top: '26.5%',
                                                    left: '35%',
                                                    transformStyle: 'preserve-3d',
                                                }}
                                            >
                                                <img
                                                    src={designs.extra.url}
                                                    alt="Extra overlay"
                                                    referrerPolicy="no-referrer"
                                                    className="absolute object-contain"
                                                    style={{
                                                        left: `${designs.extra.x}%`,
                                                        top: `${designs.extra.y}%`,
                                                        transform: `translate(-50%, -50%) rotate(${designs.extra.rotation}deg)`,
                                                        width: `${getSizeMultiplier(designs.extra.sizeType) * 100}%`,
                                                        height: 'auto',
                                                        aspectRatio: '1',
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 2. BACK PANEL CARD */}
                                <div
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{
                                        transform: 'rotateY(180deg) translateZ(15px)',
                                        transformStyle: 'preserve-3d',
                                        backfaceVisibility: 'hidden',
                                    }}
                                >
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        {renderGarmentSvg('back', 330)}

                                        {/* Design Overlay */}
                                        {designs.back.url && (
                                            <div
                                                className="absolute pointer-events-none origin-center"
                                                style={{
                                                    width: getPanelOverlayDimensions('back').width * 0.78,
                                                    height: getPanelOverlayDimensions('back').height * 0.78,
                                                    top: '25.5%',
                                                    left: '35%',
                                                }}
                                            >
                                                <img
                                                    src={designs.back.url}
                                                    alt="Back overlay"
                                                    referrerPolicy="no-referrer"
                                                    className="absolute object-contain"
                                                    style={{
                                                        left: `${designs.back.x}%`,
                                                        top: `${designs.back.y}%`,
                                                        transform: `translate(-50%, -50%) rotate(${designs.back.rotation}deg)`,
                                                        width: `${getSizeMultiplier(designs.back.sizeType) * 100}%`,
                                                        height: 'auto',
                                                        aspectRatio: '1',
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 3. LEFT SLEEVE CARD (Rotated 90 deg) */}
                                <div
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{
                                        transform: 'rotateY(-90deg) translateZ(105px) translateX(-50px)',
                                        transformStyle: 'preserve-3d',
                                        backfaceVisibility: 'hidden',
                                    }}
                                >
                                    <div className="relative w-full h-full flex items-center justify-center scale-75">
                                        {renderGarmentSvg('leftSleeve', 300)}

                                        {/* Left Sleeve Print */}
                                        {designs.leftSleeve.url && (
                                            <div
                                                className="absolute pointer-events-none origin-center"
                                                style={{
                                                    width: 140,
                                                    height: 140,
                                                    top: '32%',
                                                    left: '27.5%',
                                                }}
                                            >
                                                <img
                                                    src={designs.leftSleeve.url}
                                                    alt="Left Sleeve overlay"
                                                    referrerPolicy="no-referrer"
                                                    className="absolute object-contain"
                                                    style={{
                                                        left: `${designs.leftSleeve.x}%`,
                                                        top: `${designs.leftSleeve.y}%`,
                                                        transform: `translate(-50%, -50%) rotate(${designs.leftSleeve.rotation}deg)`,
                                                        width: `${getSizeMultiplier(designs.leftSleeve.sizeType) * 100}%`,
                                                        height: 'auto',
                                                        aspectRatio: '1',
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 4. RIGHT SLEEVE CARD (Rotated -90 deg) */}
                                <div
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{
                                        transform: 'rotateY(90deg) translateZ(105px) translateX(50px)',
                                        transformStyle: 'preserve-3d',
                                        backfaceVisibility: 'hidden',
                                    }}
                                >
                                    <div className="relative w-full h-full flex items-center justify-center scale-75">
                                        {renderGarmentSvg('rightSleeve', 300)}

                                        {/* Right Sleeve Print */}
                                        {designs.rightSleeve.url && (
                                            <div
                                                className="absolute pointer-events-none origin-center"
                                                style={{
                                                    width: 140,
                                                    height: 140,
                                                    top: '32%',
                                                    left: '27.5%',
                                                }}
                                            >
                                                <img
                                                    src={designs.rightSleeve.url}
                                                    alt="Right Sleeve overlay"
                                                    referrerPolicy="no-referrer"
                                                    className="absolute object-contain"
                                                    style={{
                                                        left: `${designs.rightSleeve.x}%`,
                                                        top: `${designs.rightSleeve.y}%`,
                                                        transform: `translate(-50%, -50%) rotate(${designs.rightSleeve.rotation}deg)`,
                                                        width: `${getSizeMultiplier(designs.rightSleeve.sizeType) * 100}%`,
                                                        height: 'auto',
                                                        aspectRatio: '1',
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>
                            {/* 3D Showroom interactive options (pause spin, manual rotate slider) */}
                            <div className="absolute bottom-2 flex items-center gap-3 bg-white/95 border border-metal-mid px-4 py-2 rounded-xl backdrop-blur-md shadow-sm z-20">
                                <button
                                    id="spin-pause-btn"
                                    onClick={() => setIsAutoSpinning(!isAutoSpinning)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${isAutoSpinning
                                            ? 'bg-metal-light text-black font-semibold border border-metal-mid'
                                            : 'text-metal-dark hover:text-black'
                                        }`}
                                >
                                    {isAutoSpinning ? '⏸️ Pause Spin' : '▶️ Auto Spin'}
                                </button>

                                <div className="w-[1px] h-4 bg-metal-mid" />

                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-metal-dark">Manual Angle</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="360"
                                        value={Math.round(autoRotateAngle)}
                                        onChange={(e) => {
                                            setIsAutoSpinning(false);
                                            setAutoRotateAngle(Number(e.target.value));
                                        }}
                                        className="w-24 accent-black bg-metal-mid h-1 rounded-lg cursor-pointer"
                                    />
                                    <span className="text-[10px] font-mono text-black font-semibold w-6">
                                        {Math.round(autoRotateAngle)}°
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};
