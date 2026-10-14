import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

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

export default function ActiveFocusVoiceMic({
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

    const activeElementRef = useRef(null);
    const frameRef = useRef();

    const [position, setPosition] = useState(null);

    // Follow the currently focused field
    useEffect(() => {
        if (!supported) return;

        const isSupportedField = (el) => {
            if (!el) return false;

            if (el.tagName === "TEXTAREA") return true;

            if (
                el.tagName === "INPUT" &&
                !["checkbox", "radio", "file", "button", "submit"].includes(el.type)
            ) {
                return true;
            }

            return false;
        };

        const updatePosition = () => {
            const el = activeElementRef.current;

            if (!el) {
                setPosition(null);
                return;
            }

            const rect = el.getBoundingClientRect();

            setPosition({
                top: rect.top + rect.height / 2,
                left: rect.right - 34,
            });

            frameRef.current = requestAnimationFrame(updatePosition);
        };

        const onFocus = (e) => {
            if (!isSupportedField(e.target)) return;

            activeElementRef.current = e.target;

            cancelAnimationFrame(frameRef.current);

            updatePosition();
        };

        const onBlur = () => {
            cancelAnimationFrame(frameRef.current);

            requestAnimationFrame(() => {
                const el = document.activeElement;

                if (isSupportedField(el)) {
                    activeElementRef.current = el;
                    updatePosition();
                } else {
                    activeElementRef.current = null;
                    setPosition(null);
                }
            });
        };

        document.addEventListener("focusin", onFocus);
        document.addEventListener("focusout", onBlur);

        return () => {
            document.removeEventListener("focusin", onFocus);
            document.removeEventListener("focusout", onBlur);

            cancelAnimationFrame(frameRef.current);
        };
    }, [supported]);

    // Insert transcript
    useEffect(() => {
        if (!transcript) return;

        const input = activeElementRef.current;

        if (!input) return;

        const value = overwrite
            ? transcript
            : appendTranscript(input.value, transcript);

        updateNativeInputValue(input, value);

        input.focus();
    }, [transcript, overwrite]);

    if (!supported || !position) return null;

    return (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
                isListening ? stopListening() : startListening()
            }
            style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                transform: "translateY(-50%)",
                zIndex: 9999,
            }}
            className={`rounded-full p-2 shadow-lg transition-all
      ${isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                }`}
        >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
    );
}