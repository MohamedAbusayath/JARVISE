export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

export type SpeechRecognitionResult = {
    transcript: string;
    isFinal: boolean;
};

export interface SpeechToTextProvider {
    isSupported(): boolean;
    listen(onResult: (result: SpeechRecognitionResult) => void, onError: (error: Error) => void): void;
    stop(): void;
}

export interface TextToSpeechProvider {
    isSupported(): boolean;
    speak(text: string, onEnd: () => void, onError: (error: Error) => void): void;
    stop(): void;
}
