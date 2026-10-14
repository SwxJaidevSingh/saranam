import { Mic, MicOff } from "lucide-react";
import { useEffect } from "react";

import useSpeechToText from "../../hooks/useSpeechToText";
import updateNativeInputValue from "../../utils/updateNativeInputValue";

function appendTranscript(existing, transcript) {
    existing = (existing || "").trim();
    transcript = (transcript || "").trim();

    if (!existing) return transcript;

    return /[.!?]$/.test(existing)
        ? `${existing} ${transcript}`
        : `${existing}. ${transcript}`;
}

export default function VoiceMicButton({
    inputRef,
    lang = "en-IN",
    overwrite = false,
}) {
    const {
        transcript,
        isListening,
        startListening,
        stopListening,
        supported,
    } = useSpeechToText({
        lang,
        continuous: false,
        interimResults: false,
    });

    useEffect(() => {
        if (!transcript || !inputRef.current) return;

        const input = inputRef.current;

        const value = overwrite
            ? transcript
            : appendTranscript(input.value, transcript);

        updateNativeInputValue(input, value);

        input.focus();
    }, [transcript]);

    if (!supported) return null;

    return (
        <button
            type="button"
            onClick={() =>
                isListening ? stopListening() : startListening()
            }
            className={`absolute right-2 top-2 p-1 rounded-full transition
      ${isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
            title="Voice input"
        >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
    );
}