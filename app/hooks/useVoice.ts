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

export function useVoice() {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const synthesisRef = useRef<SpeechSynthesis | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Initialize Speech APIs
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Speech Recognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true; // Keep listening until stopped
                recognition.interimResults = true;
                recognition.lang = 'en-US'; // Default, can be made dynamic

                // Set up event handlers during init — avoids race condition with start()
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

                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    if (currentText.trim()) {
                        silenceTimerRef.current = setTimeout(() => {
                            // Auto-stop after silence
                        }, 1500);
                    }
                };

                recognition.onend = () => {
                    setIsListening(false);
                };

                recognition.onerror = (event: any) => {
                    console.error("Speech recognition error", event.error);
                    setIsListening(false);

                    if (event.error === 'not-allowed') {
                        setError("Microphone permission denied. Please allow access in your browser settings.");
                    } else if (event.error === 'no-speech') {
                        // Ignore — just silence
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
    }, []);

    const startListening = useCallback(async () => {
        setError(null);
        if (!recognitionRef.current) {
            setError("Speech Recognition is not available.");
            return;
        }

        try {
            // Check secure context — getUserMedia requires HTTPS or localhost
            if (!window.isSecureContext) {
                setError("Microphone requires HTTPS. Please access the app via https:// or localhost.");
                return;
            }

            // Request microphone permission — this triggers the browser prompt
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Release the stream immediately — SpeechRecognition manages its own audio
            stream.getTracks().forEach(track => track.stop());

            setTranscript('');
            recognitionRef.current.start();
            setIsListening(true);
        } catch (e: any) {
            console.error("Error starting recognition:", e);
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                setError("Microphone permission denied. Please allow access in your browser settings (click the 🔒 icon in the address bar).");
            } else if (e.message && e.message.includes('already started')) {
                // Ignore if already active
                return;
            } else {
                setError(`Failed to access microphone: ${e.message}`);
            }
        }
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    }, []);

    const speak = useCallback((text: string, lang = 'en-US') => {
        if (!synthesisRef.current) return;

        // Cancel any current speaking
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

    return {
        isListening,
        isSpeaking,
        transcript,
        error,
        startListening,
        stopListening,
        speak,
        cancelSpeech,
        resetTranscript: () => setTranscript(''),
    };
}
