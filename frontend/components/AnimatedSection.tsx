import React from 'react';

interface AnimatedSectionProps {
    delay: string; // e.g., '150ms'
    children: React.ReactNode;
}

/**
 * Simple wrapper that applies the slide-up animation with a configurable delay.
 * This helps reduce duplicated JSX markup across the ResultsSection component.
 */
const AnimatedSection: React.FC<AnimatedSectionProps> = ({ delay, children }) => (
    <div className="animate-slide-up" style={{ animationDelay: delay }}>
        {children}
    </div>
);

export default AnimatedSection;
