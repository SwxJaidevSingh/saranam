import { useEffect, useRef, useState } from "react";

export default function useSpeechToText({
    lang = "en-IN",
    continuous = true,
    interimResults = true,
} = {}) {
    const recognitionRef = useRef(null);

    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [error, setError] = useState(null);

    useEffect(() => {
        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setError("Speech Recognition not supported.");
            return;
        }

        const recognition = new SpeechRecognition();

        recognition.lang = lang;
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = (e) => {
            setError(e.error);
            setIsListening(false);
        };

        recognition.onresult = (event) => {
            let text = "";

            for (let i = event.resultIndex; i < event.results.length; i++) {
                text += event.results[i][0].transcript;
            }

            setTranscript(text);
        };

        recognitionRef.current = recognition;
    }, []);

    const startListening = () => {
        if (!recognitionRef.current) return;
        setTranscript("");
        recognitionRef.current.start();
    };

    const stopListening = () => {
        recognitionRef.current?.stop();
    };

    return {
        transcript,
        error,
        isListening,
        startListening,
        stopListening,
        supported:
            !!window.SpeechRecognition ||
            !!window.webkitSpeechRecognition,
    };
}