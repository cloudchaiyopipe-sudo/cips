import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaTimes, FaChevronRight, FaChevronLeft, FaLightbulb, FaCheckCircle } from 'react-icons/fa';

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
    steps: TourStep[];
    t: (key: string) => string;
    storageKey?: string;
}

const SmartOnboardingTour: React.FC<SmartOnboardingTourProps> = ({
    isVisible,
    onComplete,
    onSkip,
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
    const [isAnimating, setIsAnimating] = useState(false);
    const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());

    const currentStepData = steps[currentStep];

    // Check if element is visible (more lenient check)
    const isElementVisible = useCallback((element: HTMLElement): boolean => {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        // Check if element is explicitly hidden
        if (style.display === 'none' || 
            style.visibility === 'hidden') {
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

    const checkStepElementVisible = useCallback((step: TourStep): boolean => {
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
        } catch (e) {
            // Invalid selector
            return false;
        }
        
        return element ? isElementVisible(element) : false;
    }, [isElementVisible]);

    const handleComplete = useCallback(() => {
        localStorage.setItem(storageKey, 'true');
        onComplete();
    }, [storageKey, onComplete]);

    // Find and highlight target element
    useEffect(() => {
        if (!isVisible || !currentStepData) return;

        const findElement = () => {
            // Special case: 'center' means no specific element
            if (currentStepData.target === 'center') {
                return null;
            }

            // Try data attribute first (most common case)
            let element = document.querySelector(`[data-tour="${currentStepData.target}"]`) as HTMLElement;
            
            // Try CSS selector if data-tour didn't work
            if (!element) {
                try {
                    element = document.querySelector(currentStepData.target) as HTMLElement;
                } catch (e) {
                    console.warn('Invalid selector:', currentStepData.target);
                }
            }

            // Try by ID if target starts with #
            if (!element && currentStepData.target.startsWith('#')) {
                element = document.getElementById(currentStepData.target.substring(1));
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

            // Calculate tooltip position based on step position preference
            let top = 0;
            let left = 0;

            switch (currentStepData.position) {
                case 'top':
                    top = rect.top + scrollTop - 20;
                    left = rect.left + scrollLeft + rect.width / 2;
                    break;
                case 'bottom':
                    top = rect.bottom + scrollTop + 20;
                    left = rect.left + scrollLeft + rect.width / 2;
                    break;
                case 'left':
                    top = rect.top + scrollTop + rect.height / 2;
                    left = rect.left + scrollLeft - 20;
                    break;
                case 'right':
                    top = rect.top + scrollTop + rect.height / 2;
                    left = rect.right + scrollLeft + 20;
                    break;
                case 'center':
                default:
                    top = rect.top + scrollTop + rect.height / 2;
                    left = rect.left + scrollLeft + rect.width / 2;
                    break;
            }

            setTooltipPosition({ top, left });
            setIsHighlighted(currentStepData.highlight !== false);

            // Scroll element into view if needed
            if (currentStepData.action?.type === 'scroll') {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // Auto-click if needed
            if (currentStepData.action?.type === 'click' && currentStepData.action.selector) {
                setTimeout(() => {
                    const clickElement = document.querySelector(currentStepData.action!.selector!) as HTMLElement;
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
                    setSkippedSteps(prev => new Set(prev).add(currentStep));
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
    }, [isVisible, currentStep, currentStepData, isAnimating, skippedSteps, steps, checkStepElementVisible, handleComplete]);

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
        onSkip();
    }, [storageKey, onSkip]);

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
        maxWidth: '400px',
    };

    // Adjust transform based on position
    if (currentStepData.position === 'top') {
        tooltipStyle.transform = 'translate(-50%, calc(-100% - 20px))';
    } else if (currentStepData.position === 'bottom') {
        tooltipStyle.transform = 'translate(-50%, 20px)';
    } else if (currentStepData.position === 'left') {
        tooltipStyle.transform = 'translate(calc(-100% - 20px), -50%)';
    } else if (currentStepData.position === 'right') {
        tooltipStyle.transform = 'translate(20px, -50%)';
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
            {isHighlighted && targetElement && (
                <div style={highlightStyle} />
            )}

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                style={tooltipStyle}
                className={`rounded-lg border-2 border-blue-500 bg-white shadow-2xl transition-all duration-300 ${
                    isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
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
                            <span>
                                {Math.round(((currentStep + 1) / steps.length) * 100)}%
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
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
                                        <span className="hidden sm:inline">{t('อันแรก') || 'อันแรก'}</span>
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
                </div>
            </div>
        </>
    );
};

export default SmartOnboardingTour;

