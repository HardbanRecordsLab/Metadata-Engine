import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from './icons';

interface AudioPlayerProps {
    file: File | null;
    className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ file, className = '' }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    // Create audio URL from file
    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setAudioUrl(url);

            return () => {
                URL.revokeObjectURL(url);
            };
        } else {
            setAudioUrl(null);
        }
    }, [file]);

    // Update current time
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audioUrl]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(console.error);
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;

        const time = parseFloat(e.target.value);
        audio.currentTime = time;
        setCurrentTime(time);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;

        const vol = parseFloat(e.target.value);
        audio.volume = vol;
        setVolume(vol);
        setIsMuted(vol === 0);
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isMuted) {
            audio.volume = volume || 0.5;
            setIsMuted(false);
        } else {
            audio.volume = 0;
            setIsMuted(true);
        }
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!file) {
        return (
            <div className={`bg-slate-100 dark:bg-slate-800 rounded-xl p-6 text-center ${className}`}>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    No audio file loaded
                </p>
            </div>
        );
    }

    return (
        <div className={`bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xl ${className}`}>
            <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />

            {/* File info */}
            <div className="mb-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                    {file.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    style={{
                        backgroundSize: `${(currentTime / duration) * 100}% 100%`,
                        backgroundImage: `linear-gradient(to right, rgb(139, 92, 246), rgb(139, 92, 246))`
                    }}
                />
                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-tighter">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button
                    onClick={togglePlay}
                    className="w-12 h-12 flex items-center justify-center bg-accent-violet hover:bg-accent-violet/90 text-white rounded-full transition-all hover:scale-110 shadow-lg shadow-accent-violet/20"
                >
                    {isPlaying ? (
                        <Pause className="w-6 h-6" />
                    ) : (
                        <Play className="w-6 h-6 ml-1" />
                    )}
                </button>

                {/* Volume */}
                <div className="flex items-center gap-2 flex-1 max-w-[120px]">
                    <button
                        onClick={toggleMute}
                        className="text-slate-600 dark:text-slate-300 hover:text-accent-violet dark:hover:text-accent-violet transition-colors"
                    >
                        {isMuted ? (
                            <VolumeX className="w-5 h-5" />
                        ) : (
                            <Volume2 className="w-5 h-5" />
                        )}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent-violet"
                    />
                </div>
            </div>
        </div>
    );
};

export default AudioPlayer;
