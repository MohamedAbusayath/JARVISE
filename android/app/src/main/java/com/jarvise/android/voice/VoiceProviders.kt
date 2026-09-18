package com.jarvise.android.voice

import android.content.Context
import android.content.Intent
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

interface SpeechToTextProvider {
    fun isSupported(): Boolean
    fun listen(onTranscript: (String) -> Unit, onError: (String) -> Unit)
    fun stop()
    fun release()
}

interface TextToSpeechProvider {
    fun isSupported(): Boolean
    fun speak(text: String, onComplete: () -> Unit, onError: (String) -> Unit)
    fun stop()
    fun release()
}

class AndroidSpeechToTextProvider(private val context: Context) : SpeechToTextProvider {
    private val recognizer = SpeechRecognizer.createSpeechRecognizer(context)

    override fun isSupported() = SpeechRecognizer.isRecognitionAvailable(context)

    override fun listen(onTranscript: (String) -> Unit, onError: (String) -> Unit) {
        if (!isSupported()) {
            onError("Speech recognition is unavailable on this device.")
            return
        }
        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: android.os.Bundle?) {
                results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    ?.takeIf(String::isNotBlank)
                    ?.let(onTranscript)
                    ?: onError("No speech was detected.")
            }
            override fun onError(error: Int) {
                onError(
                    if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS)
                        "Microphone permission is required for voice input."
                    else "Speech recognition failed. Check your network and try again."
                )
            }
            override fun onReadyForSpeech(params: android.os.Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onEndOfSpeech() = Unit
            override fun onPartialResults(partialResults: android.os.Bundle?) = Unit
            override fun onEvent(eventType: Int, params: android.os.Bundle?) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
        })
        recognizer.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
        })
    }

    override fun stop() = recognizer.stopListening()
    override fun release() = recognizer.destroy()
}

class AndroidTextToSpeechProvider(context: Context) : TextToSpeechProvider {
    private var ready = false
    private val speaker = TextToSpeech(context) { status ->
        ready = status == TextToSpeech.SUCCESS
        if (ready) speaker.language = Locale.getDefault()
    }

    override fun isSupported() = ready

    override fun speak(text: String, onComplete: () -> Unit, onError: (String) -> Unit) {
        if (!ready) {
            onError("Text-to-speech is unavailable on this device.")
            return
        }
        speaker.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onDone(utteranceId: String?) = onComplete()
            override fun onError(utteranceId: String?) = onError("JARVIS could not speak the response.")
            override fun onStart(utteranceId: String?) = Unit
        })
        speaker.speak(text, TextToSpeech.QUEUE_FLUSH, null, "jarvis-response")
    }

    override fun stop() = speaker.stop()
    override fun release() = speaker.shutdown()
}
