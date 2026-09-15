package com.jarvise.android.voice

import android.content.Context
import android.content.Intent
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import java.util.Locale

enum class VoiceState { IDLE, LISTENING, PROCESSING, SPEAKING, ERROR }

class VoiceController(
    private val context: Context,
    private val onTranscript: (String) -> Unit,
    private val onState: (VoiceState, String?) -> Unit
) {
    private val recognizer = SpeechRecognizer.createSpeechRecognizer(context)
    private lateinit var speaker: TextToSpeech

    init {
        speaker = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) speaker.language = Locale.getDefault()
        }
        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: android.os.Bundle?) { onState(VoiceState.LISTENING, null) }
            override fun onResults(results: android.os.Bundle?) {
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                if (text.isNullOrBlank()) onState(VoiceState.ERROR, "No speech was detected.")
                else {
                    onState(VoiceState.PROCESSING, null)
                    onTranscript(text)
                }
            }
            override fun onError(error: Int) {
                val message = if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS)
                    "Microphone permission is required for voice input."
                else "Speech recognition failed. Check your network and try again."
                onState(VoiceState.ERROR, message)
            }
            override fun onBeginningOfSpeech() = Unit
            override fun onEndOfSpeech() = Unit
            override fun onPartialResults(partialResults: android.os.Bundle?) = Unit
            override fun onEvent(eventType: Int, params: android.os.Bundle?) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
        })
    }

    fun listen() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onState(VoiceState.ERROR, "Speech recognition is unavailable on this device.")
            return
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
        }
        recognizer.startListening(intent)
    }

    fun speak(text: String) {
        onState(VoiceState.SPEAKING, null)
        speaker.speak(text, TextToSpeech.QUEUE_FLUSH, null, "jarvis-response")
    }

    fun stop() {
        recognizer.stopListening()
        speaker.stop()
        onState(VoiceState.IDLE, null)
    }

    fun release() {
        recognizer.destroy()
        speaker.shutdown()
    }
}
