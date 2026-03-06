'use client';

interface VoiceVisualizerProps {
    isListening: boolean;
    isSpeaking: boolean;
    onStop: () => void;
}

export default function VoiceVisualizer({ isListening, isSpeaking, onStop }: VoiceVisualizerProps) {
    if (!isListening && !isSpeaking) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-[#13111c]/90 backdrop-blur-md transition-all duration-300">
            <div className="flex flex-col items-center gap-8 animate-fade-in relative z-10 w-full px-8">

                {/* State Label */}
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                        {isListening ? "Listening..." : "Speaking..."}
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {isListening ? "Try saying 'Hello' or asking a question" : "Tap anywhere to stop"}
                    </p>
                </div>

                {/* Visualizer Animation */}
                <div className="relative w-32 h-32 flex items-center justify-center cursor-pointer" onClick={onStop}>
                    {/* Main Orb */}
                    <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-[0_0_30px_rgba(168,85,247,0.5)] z-10 transition-transform duration-200 ${isSpeaking ? 'scale-110' : 'scale-100'}`}></div>

                    {/* Ripples */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`absolute w-full h-full rounded-full border-4 border-purple-500/30 ${isListening ? 'animate-ping' : isSpeaking ? 'animate-pulse' : ''}`} style={{ animationDuration: '2s' }}></span>
                        <span className={`absolute w-full h-full rounded-full border-4 border-pink-500/20 ${isListening ? 'animate-ping' : isSpeaking ? 'animate-pulse' : ''}`} style={{ animationDuration: '2s', animationDelay: '0.5s' }}></span>
                        <span className={`absolute w-full h-full rounded-full border-4 border-purple-500/10 ${isListening ? 'animate-ping' : isSpeaking ? 'animate-pulse' : ''}`} style={{ animationDuration: '2s', animationDelay: '1s' }}></span>
                    </div>

                    {/* Stop Icon Overlay on Hover */}
                    <div className="absolute inset-0 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity z-20">
                        <svg className="w-8 h-8 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M15.75 5.25v13.5H8.25V5.25h7.5zM15.75 3H8.25C7.007 3 6 4.007 6 5.25v13.5c0 1.243 1.007 2.25 2.25 2.25h7.5c1.243 0 2.25-1.007 2.25-2.25V5.25C18 4.007 16.993 3 15.75 3z" />
                        </svg>
                    </div>
                </div>

                {/* Stop Button */}
                <button
                    onClick={onStop}
                    className="px-6 py-2 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/20 transition-colors text-sm font-medium"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
