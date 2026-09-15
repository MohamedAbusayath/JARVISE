import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserSpeechToTextProvider } from "./browser-stt.provider";
import { BrowserTextToSpeechProvider } from "./browser-tts.provider";
import type { VoiceState } from "./voice.types";

export const useVoiceInteraction = (onTranscript: (text: string) => Promise<string>) => {
    const stt = useRef(new BrowserSpeechToTextProvider());
    const tts = useRef(new BrowserTextToSpeechProvider());
    const [state, setState] = useState<VoiceState>("idle");
    const [error, setError] = useState("");

    const stop = useCallback(() => {
        stt.current.stop();
        tts.current.stop();
        setState("idle");
    }, []);

    const speak = useCallback((text: string) => {
        if (!tts.current.isSupported()) {
            setError("Text-to-speech is not supported in this browser.");
            setState("error");
            return;
        }
        setState("speaking");
        tts.current.speak(text, () => setState("idle"), (failure) => {
            setError(failure.message);
            setState("error");
        });
    }, []);

    const startListening = useCallback(() => {
        setError("");
        if (!stt.current.isSupported()) {
            setError("Voice input is not supported in this browser.");
            setState("error");
            return;
        }
        setState("listening");
        stt.current.listen(
            (result) => {
                if (!result.isFinal || !result.transcript.trim()) return;
                setState("processing");
                void onTranscript(result.transcript.trim())
                    .then((response) => speak(response))
                    .catch((failure: unknown) => {
                        setError(failure instanceof Error ? failure.message : "Voice request failed.");
                        setState("error");
                    });
            },
            (failure) => {
                setError(failure.message);
                setState("error");
            }
        );
    }, [onTranscript, speak]);

    useEffect(() => () => {
        stt.current.stop();
        tts.current.stop();
    }, []);

    return { state, error, startListening, speak, stop };
};
