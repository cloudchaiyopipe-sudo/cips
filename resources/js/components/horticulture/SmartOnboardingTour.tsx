/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaTimes, FaChevronRight, FaChevronLeft, FaLightbulb } from 'react-icons/fa';

interface TourStep {
    id: string;
    target: string; // CSS selector หรือ data attribute
    title: string;
    description: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    action?: {
        type: 'click' | 'wait' | 'scroll';
        selector?: string;
        delay?: number;
    };
    highlight?: boolean;
    nextButtonText?: string;
    skipButtonText?: string;
}

interface SmartOnboardingTourProps {
    isVisible: boolean;
    onComplete: () => void;
    onSkip: () => void;
    onDontShowAgain?: () => void;
    steps: TourStep[];
    t: (key: string) => string;
    storageKey?: string;
}

const SmartOnboardingTour: React.FC<SmartOnboardingTourProps> = ({
    isVisible,
    onComplete,
    onSkip,
    onDontShowAgain,
    steps,
    t,
    storageKey = 'horticulture_tour_completed',
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const [isHighlighted, setIsHighlighted] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const finalPositionMap = useRef<Map<number, 'top' | 'bottom' | 'left' | 'right'>>(new Map());
    const [isAnimating, setIsAnimating] = useState(false);
    const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const currentStepData = steps[currentStep];

    // Check if element is visible (more lenient check)
    const isElementVisible = useCallback((element: HTMLElement): boolean => {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        // Check if element is explicitly hidden
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        // More lenient check - allow elements that are partially visible or have size
        // Don't check opacity or exact viewport position too strictly
        if (rect.width === 0 && rect.height === 0) {
            return false;
        }

        // Check if element is in DOM and has some size
        // Allow elements that are partially off-screen or scrolled
        return true;
    }, []);

    const checkStepElementVisible = useCallback(
        (step: TourStep): boolean => {
            // Center steps are always available
            if (step.target === 'center') {
                return true;
            }

            // Check if element exists and is visible
            let element: HTMLElement | null = null;
            try {
                element = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement;
                if (!element) {
                    element = document.querySelector(step.target) as HTMLElement;
                }
                if (!element && step.target.startsWith('#')) {
                    element = document.getElementById(step.target.substring(1));
                }
            } catch (error: unknown) {
                console.warn('Invalid selector:', step.target, (error as Error).message);
                // Invalid selector
                return false;
            }

            return element ? isElementVisible(element) : false;
        },
        [isElementVisible]
    );

    const handleComplete = useCallback(() => {
        localStorage.setItem(storageKey, 'true');
        if (dontShowAgain && onDontShowAgain) {
            onDontShowAgain();
        } else {
            onComplete();
        }
    }, [storageKey, onComplete, dontShowAgain, onDontShowAgain]);

    // Find and highlight target element
    useEffect(() => {
        if (!isVisible || !currentStepData) return;

        const findElement = () => {
            // Special case: 'center' means no specific element
            if (currentStepData.target === 'center') {
                return null;
            }

            // Try data attribute first (most common case)
            let element = document.querySelector(
                `[data-tour="${currentStepData.target}"]`
            ) as HTMLElement;

            // Try CSS selector if data-tour didn't work
            if (!element) {
                try {
                    element = document.querySelector(currentStepData.target) as HTMLElement;
                } catch (error: unknown) {
                    console.warn('Invalid selector:', currentStepData.target, (error as Error).message);
                }
            }

            // Try by ID if target starts with #
            if (!element && currentStepData.target.startsWith('#')) {
                element = document.getElementById(
                    currentStepData.target.substring(1)
                ) as HTMLElement;
            }

            // Check if element is visible
            if (element && !isElementVisible(element)) {
                return null;
            }

            return element;
        };

        const updatePosition = () => {
            const element = findElement();
            if (!element) {
                // If element not found or not visible
                if (currentStepData.target === 'center') {
                    // Center step - show in center
                    setTargetElement(null);
                    setTooltipPosition({
                        top: window.innerHeight / 2,
                        left: window.innerWidth / 2,
                    });
                    setIsHighlighted(false);
                    return;
                }

                // For non-center steps, show tooltip in center but don't highlight
                // Let retry mechanism handle finding the element
                setTargetElement(null);
                setTooltipPosition({
                    top: window.innerHeight / 2,
                    left: window.innerWidth / 2,
                });
                setIsHighlighted(false);
                return;
            }

            setTargetElement(element);
            const rect = element.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            // Get actual tooltip dimensions if available, otherwise use estimates
            let tooltipWidth = 320;
            let tooltipHeight = 200;
            if (tooltipRef.current) {
                const tooltipRect = tooltipRef.current.getBoundingClientRect();
                tooltipWidth = tooltipRect.width || 320;
                tooltipHeight = tooltipRect.height || 200;
            }
            
            const spacing = 8; // Reduced spacing for closer positioning
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const padding = 10; // Minimum padding from viewport edges

            // Calculate tooltip position based on step position preference
            let top = 0;
            let left = 0;
            let finalPosition = currentStepData.position;

            // Helper function to check if position would overflow
            const checkOverflow = (pos: 'top' | 'bottom' | 'left' | 'right'): boolean => {
                let testTop = 0;
                let testLeft = 0;

                switch (pos) {
                    case 'top':
                        testTop = rect.top + scrollTop - spacing;
                        testLeft = rect.left + scrollLeft + rect.width / 2;
                        return testTop - tooltipHeight - spacing < scrollTop + padding || 
                               testLeft - tooltipWidth / 2 < scrollLeft + padding ||
                               testLeft + tooltipWidth / 2 > scrollLeft + viewportWidth - padding;
                    case 'bottom':
                        testTop = rect.bottom + scrollTop + spacing;
                        testLeft = rect.left + scrollLeft + rect.width / 2;
                        return testTop + tooltipHeight + spacing > scrollTop + viewportHeight - padding ||
                               testLeft - tooltipWidth / 2 < scrollLeft + padding ||
                               testLeft + tooltipWidth / 2 > scrollLeft + viewportWidth - padding;
                    case 'left':
                        testTop = rect.top + scrollTop + rect.height / 2;
                        testLeft = rect.left + scrollLeft - spacing;
                        return testLeft - tooltipWidth - spacing < scrollLeft + padding ||
                               testTop - tooltipHeight / 2 < scrollTop + padding ||
                               testTop + tooltipHeight / 2 > scrollTop + viewportHeight - padding;
                    case 'right':
                        testTop = rect.top + scrollTop + rect.height / 2;
                        testLeft = rect.right + scrollLeft + spacing;
                        return testLeft + tooltipWidth + spacing > scrollLeft + viewportWidth - padding ||
                               testTop - tooltipHeight / 2 < scrollTop + padding ||
                               testTop + tooltipHeight / 2 > scrollTop + viewportHeight - padding;
                }
                return false;
            };

            // Try preferred position first, then find best alternative
            const preferredPosition = currentStepData.position || 'bottom';
            const allPositions: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right'];
            
            // Filter out 'center' from preferred position if it exists
            const validPreferredPosition: 'top' | 'bottom' | 'left' | 'right' = 
                (preferredPosition !== 'center' && allPositions.includes(preferredPosition as 'top' | 'bottom' | 'left' | 'right'))
                    ? preferredPosition as 'top' | 'bottom' | 'left' | 'right'
                    : 'bottom';
            
            // Reorder positions to try preferred first, then others
            const positionsToTry = [
                validPreferredPosition,
                ...allPositions.filter(p => p !== validPreferredPosition)
            ];

            // Find first position that doesn't overflow
            for (const pos of positionsToTry) {
                if (!checkOverflow(pos)) {
                    finalPosition = pos;
                    break;
                }
            }

            // Calculate final position with proper boundary checks
            switch (finalPosition) {
                case 'top':
                    top = rect.top + scrollTop - spacing;
                    left = rect.left + scrollLeft + rect.width / 2;
                    // Ensure tooltip doesn't go off left/right edges
                    left = Math.max(scrollLeft + tooltipWidth / 2 + padding, 
                        Math.min(left, scrollLeft + viewportWidth - tooltipWidth / 2 - padding));
                    // Ensure tooltip doesn't go off top edge
                    if (top - tooltipHeight - spacing < scrollTop + padding) {
                        // If would overflow top, switch to bottom
                        top = rect.bottom + scrollTop + spacing;
                    }
                    break;
                case 'bottom':
                    top = rect.bottom + scrollTop + spacing;
                    left = rect.left + scrollLeft + rect.width / 2;
                    // Ensure tooltip doesn't go off left/right edges
                    left = Math.max(scrollLeft + tooltipWidth / 2 + padding, 
                        Math.min(left, scrollLeft + viewportWidth - tooltipWidth / 2 - padding));
                    // Ensure tooltip doesn't go off bottom edge
                    if (top + tooltipHeight + spacing > scrollTop + viewportHeight - padding) {
                        // If would overflow bottom, switch to top
                        top = rect.top + scrollTop - spacing;
                    }
                    break;
                case 'left':
                    top = rect.top + scrollTop + rect.height / 2;
                    left = rect.left + scrollLeft - spacing;
                    // Ensure tooltip doesn't go off left edge - if it would, switch to right
                    if (left - tooltipWidth - spacing < scrollLeft + padding) {
                        left = rect.right + scrollLeft + spacing;
                        finalPosition = 'right';
                    }
                    // Ensure tooltip doesn't go off top/bottom edges
                    top = Math.max(scrollTop + tooltipHeight / 2 + padding, 
                        Math.min(top, scrollTop + viewportHeight - tooltipHeight / 2 - padding));
                    break;
                case 'right':
                    top = rect.top + scrollTop + rect.height / 2;
                    left = rect.right + scrollLeft + spacing;
                    // Ensure tooltip doesn't go off right edge - if it would, switch to left
                    if (left + tooltipWidth + spacing > scrollLeft + viewportWidth - padding) {
                        left = rect.left + scrollLeft - spacing;
                        finalPosition = 'left';
                        // But if left would also overflow, use top or bottom instead
                        if (left - tooltipWidth - spacing < scrollLeft + padding) {
                            // Use top position instead
                            top = rect.top + scrollTop - spacing;
                            left = rect.left + scrollLeft + rect.width / 2;
                            finalPosition = 'top';
                            left = Math.max(scrollLeft + tooltipWidth / 2 + padding, 
                                Math.min(left, scrollLeft + viewportWidth - tooltipWidth / 2 - padding));
                        }
                    }
                    // Ensure tooltip doesn't go off top/bottom edges
                    top = Math.max(scrollTop + tooltipHeight / 2 + padding, 
                        Math.min(top, scrollTop + viewportHeight - tooltipHeight / 2 - padding));
                    break;
                case 'center':
                default:
                    top = rect.top + scrollTop + rect.height / 2;
                    left = rect.left + scrollLeft + rect.width / 2;
                    break;
            }

            setTooltipPosition({ top, left });
            setIsHighlighted(currentStepData.highlight !== false);
            
            // Store final position for tooltip transform
            // Using a type-safe approach by storing in a separate map
            if (!finalPositionMap.current) {
                finalPositionMap.current = new Map();
            }
            // Only store if finalPosition is not 'center'
            if (finalPosition !== 'center') {
                finalPositionMap.current.set(currentStep, finalPosition);
            }

            // Scroll element into view if needed
            if (currentStepData.action?.type === 'scroll') {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // Auto-click if needed
            if (currentStepData.action?.type === 'click' && currentStepData.action.selector) {
                setTimeout(() => {
                    const clickElement = document.querySelector(
                        currentStepData.action!.selector!
                    ) as HTMLElement;
                    if (clickElement) {
                        clickElement.click();
                    }
                }, currentStepData.action.delay || 500);
            }
        };

        // Initial update
        updatePosition();

        // Update on scroll/resize
        const handleUpdate = () => {
            if (!isAnimating) {
                updatePosition();
            }
        };

        window.addEventListener('scroll', handleUpdate, true);
        window.addEventListener('resize', handleUpdate);

        // Retry finding element (in case it's not loaded yet)
        // Only retry for non-center steps
        let retryCount = 0;
        const maxRetries = 20; // Retry for 10 seconds (20 * 500ms) - longer wait for elements to appear

        const retryInterval = setInterval(() => {
            if (currentStepData.target === 'center') {
                clearInterval(retryInterval);
                return;
            }

            if (skippedSteps.has(currentStep)) {
                clearInterval(retryInterval);
                return;
            }

            retryCount++;
            const element = findElement();

            if (element && isElementVisible(element)) {
                updatePosition();
                clearInterval(retryInterval);
            } else if (retryCount >= maxRetries) {
                // Max retries reached, skip this step and find next visible one
                if (!skippedSteps.has(currentStep)) {
                    setSkippedSteps((prev) => new Set(prev).add(currentStep));
                    // Find next visible step
                    setTimeout(() => {
                        handleNext();
                    }, 500);
                }
                clearInterval(retryInterval);
            }
            // Don't update position during retry to avoid flickering
        }, 500);

        return () => {
            window.removeEventListener('scroll', handleUpdate, true);
            window.removeEventListener('resize', handleUpdate);
            clearInterval(retryInterval);
        };
    }, [
        isVisible,
        currentStep,
        currentStepData,
        isAnimating,
        skippedSteps,
        steps,
        checkStepElementVisible,
        handleComplete,
    ]);

    // Recalculate position after tooltip is rendered to use actual dimensions
    useEffect(() => {
        if (!isVisible || !targetElement || !tooltipRef.current || !currentStepData) return;

        const element = targetElement;
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width || 320;
        const tooltipHeight = tooltipRect.height || 200;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const spacing = 8;
        const padding = 10;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const finalPosition = finalPositionMap.current.get(currentStep) || 
            (currentStepData?.position && currentStepData.position !== 'center' ? currentStepData.position : 'bottom') || 'bottom';

        let top = tooltipPosition.top;
        let left = tooltipPosition.left;

        // Fine-tune position with actual tooltip dimensions
        switch (finalPosition) {
            case 'left':
                left = rect.left + scrollLeft - spacing;
                if (left - tooltipWidth - spacing < scrollLeft + padding) {
                    // Switch to right if left would overflow
                    left = rect.right + scrollLeft + spacing;
                    if (left + tooltipWidth + spacing > scrollLeft + viewportWidth - padding) {
                        // Switch to top if both left and right would overflow
                        top = rect.top + scrollTop - spacing;
                        left = rect.left + scrollLeft + rect.width / 2;
                        left = Math.max(scrollLeft + tooltipWidth / 2 + padding, 
                            Math.min(left, scrollLeft + viewportWidth - tooltipWidth / 2 - padding));
                    }
                }
                top = Math.max(scrollTop + tooltipHeight / 2 + padding, 
                    Math.min(top, scrollTop + viewportHeight - tooltipHeight / 2 - padding));
                break;
            case 'right':
                left = rect.right + scrollLeft + spacing;
                if (left + tooltipWidth + spacing > scrollLeft + viewportWidth - padding) {
                    // Switch to left if right would overflow
                    left = rect.left + scrollLeft - spacing;
                    if (left - tooltipWidth - spacing < scrollLeft + padding) {
                        // Switch to top if both would overflow
                        top = rect.top + scrollTop - spacing;
                        left = rect.left + scrollLeft + rect.width / 2;
                        left = Math.max(scrollLeft + tooltipWidth / 2 + padding, 
                            Math.min(left, scrollLeft + viewportWidth - tooltipWidth / 2 - padding));
                    }
                }
                top = Math.max(scrollTop + tooltipHeight / 2 + padding, 
                    Math.min(top, scrollTop + viewportHeight - tooltipHeight / 2 - padding));
                break;
            case 'top':
                top = rect.top + scrollTop - spacing;
                left = rect.left + scrollLeft + rect.width / 2;
                left = Math.max(scrollLeft + tooltipWidth / 2 + padding, 
                    Math.min(left, scrollLeft + viewportWidth - tooltipWidth / 2 - padding));
                if (top - tooltipHeight - spacing < scrollTop + padding) {
                    top = rect.bottom + scrollTop + spacing;
                }
                break;
            case 'bottom':
                top = rect.bottom + scrollTop + spacing;
                left = rect.left + scrollLeft + rect.width / 2;
                left = Math.max(scrollLeft + tooltipWidth / 2 + padding, 
                    Math.min(left, scrollLeft + viewportWidth - tooltipWidth / 2 - padding));
                if (top + tooltipHeight + spacing > scrollTop + viewportHeight - padding) {
                    top = rect.top + scrollTop - spacing;
                }
                break;
        }

        // Only update if position changed significantly
        if (Math.abs(top - tooltipPosition.top) > 1 || Math.abs(left - tooltipPosition.left) > 1) {
            setTooltipPosition({ top, left });
        }
    }, [isVisible, targetElement, currentStep, currentStepData, tooltipPosition]);

    const handleNext = useCallback(() => {
        // Find next available step (skip steps with invisible elements)
        let nextStep = currentStep + 1;

        while (nextStep < steps.length) {
            const step = steps[nextStep];

            if (checkStepElementVisible(step)) {
                break;
            }

            // Element not found or not visible, skip to next
            nextStep++;
        }

        if (nextStep < steps.length) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentStep(nextStep);
                setIsAnimating(false);
            }, 300);
        } else {
            handleComplete();
        }
    }, [steps, currentStep, checkStepElementVisible, handleComplete]);

    const handlePrevious = () => {
        if (currentStep > 0) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentStep(currentStep - 1);
                setIsAnimating(false);
            }, 300);
        }
    };

    const handleGoToFirst = () => {
        setIsAnimating(true);
        setTimeout(() => {
            setCurrentStep(0);
            setIsAnimating(false);
        }, 300);
    };

    const handleSkip = useCallback(() => {
        localStorage.setItem(storageKey, 'skipped');
        if (dontShowAgain && onDontShowAgain) {
            onDontShowAgain();
        } else {
            onSkip();
        }
    }, [storageKey, onSkip, dontShowAgain, onDontShowAgain]);

    if (!isVisible || !currentStepData) return null;

    // Calculate highlight box position
    const highlightStyle: React.CSSProperties = targetElement
        ? {
              position: 'absolute',
              top: targetElement.getBoundingClientRect().top + window.scrollY,
              left: targetElement.getBoundingClientRect().left + window.scrollX,
              width: targetElement.getBoundingClientRect().width,
              height: targetElement.getBoundingClientRect().height,
              borderRadius: '8px',
              border: '3px solid #3B82F6',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              pointerEvents: 'none',
              zIndex: 9998,
              transition: 'all 0.3s ease',
          }
        : { display: 'none' };

    // Calculate tooltip position with bounds checking
    const tooltipStyle: React.CSSProperties = {
        position: 'absolute',
        top: `${Math.max(20, Math.min(tooltipPosition.top, window.innerHeight - 300))}px`,
        left: `${Math.max(20, Math.min(tooltipPosition.left, window.innerWidth - 400))}px`,
        zIndex: 9999,
        transform: 'translate(-50%, -50%)',
        transition: 'all 0.3s ease',
        maxWidth: '450px',
    };

    // Adjust transform based on final calculated position
    // Use finalPositionMap if available (from updatePosition), otherwise fall back to position
    const finalPosition = finalPositionMap.current.get(currentStep) || 
        (currentStepData?.position && currentStepData.position !== 'center' ? currentStepData.position : 'bottom') || 'bottom';
    const spacing = 8; // Reduced spacing for closer positioning (matches updatePosition)
    
    if (finalPosition === 'top') {
        tooltipStyle.transform = `translate(-50%, calc(-100% - ${spacing}px))`;
    } else if (finalPosition === 'bottom') {
        tooltipStyle.transform = `translate(-50%, ${spacing}px)`;
    } else if (finalPosition === 'left') {
        tooltipStyle.transform = `translate(calc(-100% - ${spacing}px), -50%)`;
    } else if (finalPosition === 'right') {
        tooltipStyle.transform = `translate(${spacing}px, -50%)`;
    }

    // Early return if no step data
    if (!currentStepData || !isVisible || steps.length === 0) {
        return null;
    }

    return (
        <>
            {/* Overlay */}
            <div
                ref={overlayRef}
                className="fixed inset-0 z-[9997] bg-black bg-opacity-50 transition-opacity duration-300"
                onClick={handleNext}
            />

            {/* Highlight Box */}
            {isHighlighted && targetElement && <div style={highlightStyle} />}

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                style={tooltipStyle}
                className={`rounded-lg border-2 border-blue-500 bg-white shadow-2xl transition-all duration-300 ${
                    isAnimating ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
                }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between rounded-t-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <FaLightbulb className="text-yellow-300" size={20} />
                        <h3 className="font-bold text-white">
                            {t(currentStepData.title) || currentStepData.title}
                        </h3>
                    </div>
                    <button
                        onClick={handleSkip}
                        className="text-white transition-colors hover:text-gray-200"
                        title={t('ปิด') || 'ปิด'}
                    >
                        <FaTimes size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <p className="mb-4 text-gray-700">
                        {t(currentStepData.description) || currentStepData.description}
                    </p>

                    {/* Progress */}
                    <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                            <span>
                                {t('ขั้นตอน') || 'ขั้นตอน'} {currentStep + 1} / {steps.length}
                            </span>
                            <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex gap-2">
                                {currentStep > 0 && (
                                    <>
                                        <button
                                            onClick={handleGoToFirst}
                                            className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100"
                                            title={t('กลับไปขั้นตอนแรก') || 'กลับไปขั้นตอนแรก'}
                                        >
                                            <span>⏮️</span>
                                            <span className="hidden sm:inline">
                                                {t('อันแรก') || 'อันแรก'}
                                            </span>
                                        </button>
                                        <button
                                            onClick={handlePrevious}
                                            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                        >
                                            <FaChevronLeft size={12} />
                                            {t('ย้อนกลับ') || 'ย้อนกลับ'}
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={handleSkip}
                                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                >
                                    {currentStepData.skipButtonText || t('ข้าม') || 'ข้าม'}
                                </button>
                            </div>
                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                            >
                                {currentStep === steps.length - 1
                                    ? t('เสร็จสิ้น') || 'เสร็จสิ้น'
                                    : currentStepData.nextButtonText || t('ต่อไป') || 'ต่อไป'}
                                {currentStep < steps.length - 1 && <FaChevronRight size={12} />}
                            </button>
                        </div>
                        {onDontShowAgain && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="dont-show-again"
                                    checked={dontShowAgain}
                                    onChange={(e) => setDontShowAgain(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                />
                                <label
                                    htmlFor="dont-show-again"
                                    className="text-sm text-gray-700 cursor-pointer"
                                >
                                    {t('อย่าแสดงอีก') || 'อย่าแสดงอีก'}
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default SmartOnboardingTour;
