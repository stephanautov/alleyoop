// src/components/ui/animated-progress.tsx

import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';

interface AnimatedProgressProps {
    value: number;
    className?: string;
    showPulse?: boolean;
    color?: string;
}

export function AnimatedProgress({
    value,
    className,
    showPulse = true,
    color = 'bg-primary'
}: AnimatedProgressProps) {
    return (
        <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}>
            <motion.div
                className={cn(
                    'h-full rounded-full',
                    color,
                    showPulse && value < 100 && 'animate-pulse'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{
                    duration: 0.5,
                    ease: 'easeInOut',
                }}
            />
            {value < 100 && (
                <motion.div
                    className={cn('absolute inset-0 rounded-full', color)}
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: 0 }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            )}
        </div>
    );
}