import type { SpeechRecognitionResult, SpeechToTextProvider } from "./voice.types";

type RecognitionEvent = {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type RecognitionErrorEvent = { error?: string };
type Recognition = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: RecognitionEvent) => void) | null;
    onerror: ((event: RecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
};

type RecognitionConstructor = new () => Recognition;

const getConstructor = (): RecognitionConstructor | undefined => {
    const browser = window as Window & {
        SpeechRecognition?: RecognitionConstructor;
        webkitSpeechRecognition?: RecognitionConstructor;
    };
    return browser.SpeechRecognition || browser.webkitSpeechRecognition;
};

export class BrowserSpeechToTextProvider implements SpeechToTextProvider {
    private recognition?: Recognition;

    isSupported(): boolean {
        return typeof window !== "undefined" && Boolean(getConstructor());
    }

    listen(onResult: (result: SpeechRecognitionResult) => void, onError: (error: Error) => void): void {
        const Constructor = getConstructor();
        if (!Constructor) {
            onError(new Error("Speech recognition is not supported in this browser."));
            return;
        }

        this.stop();
        const recognition = new Constructor();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = navigator.language || "en-US";
        recognition.onresult = (event) => {
            const last = event.results[event.results.length - 1];
            if (!last) return;
            onResult({
                transcript: last[0].transcript,
                isFinal: true
            });
        };
        recognition.onerror = (event) => {
            const message = event.error === "not-allowed" || event.error === "service-not-allowed"
                ? "Microphone permission was denied. Allow microphone access and try again."
                : "Speech recognition could not start. Check your microphone and network connection.";
            onError(new Error(message));
        };
        recognition.onend = () => {
            this.recognition = undefined;
        };
        this.recognition = recognition;
        try {
            recognition.start();
        } catch {
            onError(new Error("Microphone is already in use. Please try again."));
        }
    }

    stop(): void {
        this.recognition?.stop();
        this.recognition = undefined;
    }
}
