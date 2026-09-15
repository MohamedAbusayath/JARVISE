import type { TextToSpeechProvider } from "./voice.types";

export class BrowserTextToSpeechProvider implements TextToSpeechProvider {
    isSupported(): boolean {
        return typeof window !== "undefined" && "speechSynthesis" in window;
    }

    speak(text: string, onEnd: () => void, onError: (error: Error) => void): void {
        if (!this.isSupported()) {
            onError(new Error("Text-to-speech is not supported in this browser."));
            return;
        }
        this.stop();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = onEnd;
        utterance.onerror = () => onError(new Error("JARVIS could not speak the response."));
        window.speechSynthesis.speak(utterance);
    }

    stop(): void {
        if (this.isSupported()) window.speechSynthesis.cancel();
    }
}
