package com.jarvise.android

import android.Manifest
import android.os.Build
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.jarvise.android.data.JarvisApi
import com.jarvise.android.data.SessionStore
import com.jarvise.android.voice.VoiceController
import com.jarvise.android.voice.VoiceState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class UiMessage(val role: String, val text: String)

class MainActivity : ComponentActivity() {
    private lateinit var sessionStore: SessionStore
    private lateinit var api: JarvisApi
    private lateinit var voice: VoiceController
    private val messages = mutableStateListOf<UiMessage>()
    private var authenticated by mutableStateOf(false)
    private var authMode by mutableStateOf("login")
    private var email by mutableStateOf("")
    private var password by mutableStateOf("")
    private var draft by mutableStateOf("")
    private var busy by mutableStateOf(false)
    private var error by mutableStateOf("")
    private var voiceState by mutableStateOf(VoiceState.IDLE)
    private var notificationsEnabled by mutableStateOf(false)

    private val microphonePermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) voice.listen() else error = "Microphone permission is required for voice input."
    }
    private val notificationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        notificationsEnabled = granted
        if (!granted) error = "Notifications remain disabled until you grant permission."
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sessionStore = SessionStore(this)
        api = JarvisApi(sessionStore)
        voice = VoiceController(this, ::submitVoice, ::onVoiceState)
        authenticated = sessionStore.accessToken != null
        setContent { MaterialTheme { if (authenticated) ChatScreen() else AuthScreen() } }
    }

    private fun authenticate() {
        busy = true
        lifecycleScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    if (authMode == "login") api.login(email, password) else api.register(email, password)
                }
                response.session?.accessToken?.let { SessionStore(this@MainActivity).save(it) }
                if (response.session?.accessToken == null) error = response.error ?: "Authentication did not return a session."
                else authenticated = true
            } catch (e: Exception) { error = e.message ?: "Unable to reach JARVISE." }
            finally { busy = false }
        }
    }

    private fun submit(text: String) {
        messages.add(UiMessage("user", text))
        busy = true
        lifecycleScope.launch {
            try {
                val response = withContext(Dispatchers.IO) { api.chat(text) }
                val reply = response.reply ?: throw IllegalStateException(response.error ?: "Empty response")
                messages.add(UiMessage("assistant", reply))
                voice.speak(reply)
            } catch (e: Exception) {
                error = e.message ?: "JARVISE could not respond."
                voiceState = VoiceState.ERROR
            } finally { busy = false }
        }
    }

    private fun submitVoice(text: String) {
        submit(text)
    }

    private fun onVoiceState(state: VoiceState, message: String?) {
        voiceState = state
        if (message != null) error = message
    }

    private fun startVoice() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            microphonePermission.launch(Manifest.permission.RECORD_AUDIO)
        } else voice.listen()
    }

    private fun requestNotifications() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            notificationsEnabled = true
            return
        }

        private fun logout() {
            lifecycleScope.launch {
                try {
                    withContext(Dispatchers.IO) { api.logout() }
                } catch (_: Exception) {
                    sessionStore.clear()
                } finally {
                    authenticated = false
                    messages.clear()
                    draft = ""
                    error = ""
                }
            }
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            notificationsEnabled = true
        } else {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    override fun onDestroy() {
        voice.release()
        super.onDestroy()
    }

    @androidx.compose.runtime.Composable
    private fun AuthScreen() {
        Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
            Text("JARVISE", style = MaterialTheme.typography.headlineLarge)
            Text("Secure personal intelligence", Modifier.padding(bottom = 24.dp))
            OutlinedTextField(email, { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(password, { password = it }, label = { Text("Password") }, modifier = Modifier.fillMaxWidth())
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
            Button({ authenticate() }, enabled = !busy && email.isNotBlank() && password.isNotBlank(), Modifier.padding(top = 16.dp)) {
                Text(if (authMode == "login") "Sign in" else "Create account")
            }
            Button({ authMode = if (authMode == "login") "register" else "login" }) {
                Text(if (authMode == "login") "Create an account" else "Back to sign in")
            }
        }
    }

    @androidx.compose.runtime.Composable
    private fun ChatScreen() {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("JARVISE", style = MaterialTheme.typography.headlineMedium)
                Button({ logout() }, enabled = !busy) { Text("Sign out") }
            }
            LazyColumn(Modifier.weight(1f)) {
                items(messages) { Text("${it.role}: ${it.text}", Modifier.padding(vertical = 8.dp)) }
            }
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
            Row(Modifier.fillMaxWidth()) {
                OutlinedTextField(draft, { draft = it }, label = { Text("Message JARVIS") }, modifier = Modifier.weight(1f))
                Button({ if (draft.isNotBlank()) { val text = draft; draft = ""; submit(text) } }, enabled = !busy) { Text("Send") }
            }
            Button({ if (voiceState == VoiceState.LISTENING) voice.stop() else startVoice() }, enabled = !busy) {
                Text(if (voiceState == VoiceState.LISTENING) "Stop listening" else "Voice: ${voiceState.name.lowercase()}")
            }
            Button({ requestNotifications() }, enabled = !notificationsEnabled) {
                Text(if (notificationsEnabled) "Notifications enabled" else "Enable notifications")
            }
        }
    }
}
