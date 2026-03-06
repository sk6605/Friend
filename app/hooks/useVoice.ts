import { useState, useEffect, useCallback, useRef } from 'react';

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: (event: Event) => void;
    onend: (event: Event) => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: any) => void;
}

declare global {
    interface Window {
        SpeechRecognition: { new(): SpeechRecognition };
        webkitSpeechRecognition: { new(): SpeechRecognition };
    }
}

const IDLE_TIMEOUT_MS = 3000;   // Auto-close after 3s of no speech
const MAX_DURATION_MS = 15000;  // Hard limit: 15s max

const LANG_MAP: Record<string, string> = {
    en: 'en-US',
    zh: 'zh-CN',
    ja: 'ja-JP',
    ko: 'ko-KR',
    es: 'es-ES',
    ms: 'ms-MY',
};

export function useVoice(lang?: string) {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const synthesisRef = useRef<SpeechSynthesis | null>(null);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const langRef = useRef<string>(LANG_MAP[lang ?? ''] ?? lang ?? 'en-US');

    // Keep langRef in sync with prop
    langRef.current = LANG_MAP[lang ?? ''] ?? lang ?? 'en-US';

    // Clear all timers
    const clearAllTimers = useCallback(() => {
        if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        setTimeRemaining(null);
    }, []);

    // Initialize Speech APIs
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Speech Recognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event: SpeechRecognitionEvent) => {
                    let finalTranscript = '';
                    let interimTranscript = '';

                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }

                    const currentText = finalTranscript || interimTranscript;
                    setTranscript(currentText);

                    // Reset idle timer on each speech result
                    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
                    if (currentText.trim()) {
                        idleTimerRef.current = setTimeout(() => {
                            // Auto-stop after silence following speech
                            if (recognitionRef.current) {
                                recognitionRef.current.stop();
                                setIsListening(false);
                                clearAllTimers();
                            }
                        }, IDLE_TIMEOUT_MS);
                    }
                };

                recognition.onend = () => {
                    setIsListening(false);
                    clearAllTimers();
                };

                recognition.onerror = (event: any) => {
                    console.error("Speech recognition error", event.error);
                    setIsListening(false);
                    clearAllTimers();

                    if (event.error === 'not-allowed') {
                        setError("Microphone permission denied. Please allow access in your browser settings.");
                    } else if (event.error === 'no-speech') {
                        // Ignore — the idle timer will handle this
                    } else {
                        setError(`Speech error: ${event.error}`);
                    }
                };

                recognitionRef.current = recognition;
            } else {
                setError("Speech Recognition not supported in this browser.");
            }

            // Speech Synthesis
            if (window.speechSynthesis) {
                synthesisRef.current = window.speechSynthesis;
            }
        }
    }, [clearAllTimers]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
        clearAllTimers();
    }, [clearAllTimers]);

    const startListening = useCallback(async () => {
        setError(null);
        if (!recognitionRef.current) {
            setError("Speech Recognition is not available.");
            return;
        }

        try {
            // Check secure context
            if (!window.isSecureContext) {
                setError("Microphone requires HTTPS. Please access the app via https:// or localhost.");
                return;
            }

            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());

            setTranscript('');
            recognitionRef.current.start();
            setIsListening(true);

            // Start countdown
            startTimeRef.current = Date.now();
            const maxSec = MAX_DURATION_MS / 1000;
            setTimeRemaining(maxSec);

            // Countdown interval (update every second)
            countdownRef.current = setInterval(() => {
                const elapsed = Date.now() - startTimeRef.current;
                const remaining = Math.max(0, Math.ceil((MAX_DURATION_MS - elapsed) / 1000));
                setTimeRemaining(remaining);
            }, 1000);

            // Idle timeout: auto-close if no speech detected within 3s
            idleTimerRef.current = setTimeout(() => {
                if (recognitionRef.current) {
                    recognitionRef.current.stop();
                    setIsListening(false);
                    clearAllTimers();
                }
            }, IDLE_TIMEOUT_MS);

            // Max duration: hard stop at 15s
            maxTimerRef.current = setTimeout(() => {
                if (recognitionRef.current) {
                    recognitionRef.current.stop();
                    setIsListening(false);
                    clearAllTimers();
                }
            }, MAX_DURATION_MS);

        } catch (e: any) {
            console.error("Error starting recognition:", e);
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                setError("Microphone permission denied. Please allow access in your browser settings (click the 🔒 icon in the address bar).");
            } else if (e.message && e.message.includes('already started')) {
                return;
            } else {
                setError(`Failed to access microphone: ${e.message}`);
            }
        }
    }, [clearAllTimers]);

    const speak = useCallback((text: string, lang = 'en-US') => {
        if (!synthesisRef.current) return;

        synthesisRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        const voices = synthesisRef.current.getVoices();
        const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha"));
        if (preferredVoice) utterance.voice = preferredVoice;

        synthesisRef.current.speak(utterance);
    }, []);

    const cancelSpeech = useCallback(() => {
        if (synthesisRef.current) {
            synthesisRef.current.cancel();
            setIsSpeaking(false);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearAllTimers();
        };
    }, [clearAllTimers]);

    return {
        isListening,
        isSpeaking,
        transcript,
        error,
        timeRemaining,
        maxDuration: MAX_DURATION_MS / 1000,
        startListening,
        stopListening,
        speak,
        cancelSpeech,
        resetTranscript: () => setTranscript(''),
    };
}
