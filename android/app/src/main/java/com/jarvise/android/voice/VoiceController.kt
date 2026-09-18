package com.jarvise.android.voice

import android.content.Context

enum class VoiceState { IDLE, LISTENING, PROCESSING, SPEAKING, ERROR }

class VoiceController(
    context: Context,
    private val onTranscript: (String) -> Unit,
    private val onState: (VoiceState, String?) -> Unit,
    private val stt: SpeechToTextProvider = AndroidSpeechToTextProvider(context),
    private val tts: TextToSpeechProvider = AndroidTextToSpeechProvider(context)
) {
    fun listen() {
        if (!stt.isSupported()) {
            onState(VoiceState.ERROR, "Speech recognition is unavailable on this device.")
            return
        }
        onState(VoiceState.LISTENING, null)
        stt.listen(
            onTranscript = {
                onState(VoiceState.PROCESSING, null)
                onTranscript(it)
            },
            onError = { onState(VoiceState.ERROR, it) }
        )
    }

    fun speak(text: String) {
        if (!tts.isSupported()) {
            onState(VoiceState.ERROR, "Text-to-speech is unavailable on this device.")
            return
        }
        onState(VoiceState.SPEAKING, null)
        tts.speak(text, { onState(VoiceState.IDLE, null) }) {
            onState(VoiceState.ERROR, it)
        }
    }

    fun stop() {
        stt.stop()
        tts.stop()
        onState(VoiceState.IDLE, null)
    }

    fun release() {
        stt.release()
        tts.release()
    }
}
