import React from 'react';

const Shimmer: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-slate-200/40 dark:via-slate-700/40 to-transparent animate-shimmer ${className}`} style={{ backgroundSize: '1000px 100%' }} />
);

const SkeletonBlock: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`relative overflow-hidden bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`}>
        <Shimmer />
    </div>
);

const ResultsSkeleton: React.FC = () => {
    return (
        <div className="animate-fade-in space-y-6">
            {/* Header Area */}
            <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                    <SkeletonBlock className="h-8 w-8 rounded-full" />
                    <SkeletonBlock className="h-6 w-48" />
                </div>
                <SkeletonBlock className="h-9 w-24 rounded-lg" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Track Identity Card Skeleton */}
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                        <div className="flex flex-col md:flex-row gap-6 mb-8">
                            <SkeletonBlock className="w-40 h-40 rounded-lg shrink-0" />
                            <div className="flex-grow space-y-4">
                                <SkeletonBlock className="h-6 w-3/4" />
                                <SkeletonBlock className="h-6 w-1/2" />
                                <div className="grid grid-cols-2 gap-4">
                                    <SkeletonBlock className="h-6 w-full" />
                                    <SkeletonBlock className="h-6 w-full" />
                                </div>
                                <SkeletonBlock className="h-6 w-1/3" />
                            </div>
                        </div>
                    </div>

                    {/* Sonic Analysis Display Skeleton */}
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                        <SkeletonBlock className="h-6 w-48 mb-6" />
                        <div className="grid grid-cols-3 gap-4">
                            <SkeletonBlock className="h-20 w-full" />
                            <SkeletonBlock className="h-20 w-full" />
                            <SkeletonBlock className="h-20 w-full" />
                            <SkeletonBlock className="h-20 w-full" />
                            <SkeletonBlock className="h-20 w-full" />
                            <SkeletonBlock className="h-20 w-full" />
                        </div>
                    </div>

                    {/* Classification & Style Card Skeleton */}
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                        <SkeletonBlock className="h-6 w-48 mb-6" />
                        <SkeletonBlock className="h-10 w-full mb-4" />
                        <SkeletonBlock className="h-24 w-full mb-4" />
                        <SkeletonBlock className="h-24 w-full" />
                    </div>

                    {/* Context & Marketing Card Skeleton */}
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                        <SkeletonBlock className="h-6 w-48 mb-6" />
                        <SkeletonBlock className="h-32 w-full mb-4" />
                        <div className="grid grid-cols-3 gap-3">
                            <SkeletonBlock className="h-10 w-full" />
                            <SkeletonBlock className="h-10 w-full" />
                            <SkeletonBlock className="h-10 w-full" />
                        </div>
                    </div>

                    {/* Commercial & Legal Card Skeleton */}
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                        <SkeletonBlock className="h-6 w-48 mb-6" />
                        <div className="grid grid-cols-2 gap-4">
                            <SkeletonBlock className="h-16 w-full" />
                            <SkeletonBlock className="h-16 w-full" />
                            <SkeletonBlock className="h-16 w-full" />
                            <SkeletonBlock className="h-16 w-full" />
                        </div>
                    </div>
                </div>

                {/* Sidebar Skeleton */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 h-full min-h-[500px]">
                        <SkeletonBlock className="h-6 w-32 mb-6" />
                        <div className="space-y-4">
                            <SkeletonBlock className="h-10 w-full" />
                            <SkeletonBlock className="h-10 w-full" />
                            <SkeletonBlock className="h-10 w-full" />
                            <SkeletonBlock className="h-48 w-full" /> {/* Lyrics textarea */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultsSkeleton;