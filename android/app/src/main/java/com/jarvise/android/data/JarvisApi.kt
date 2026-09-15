package com.jarvise.android.data

import com.jarvise.android.BuildConfig
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

@Serializable
data class AuthRequest(val email: String, val password: String)

@Serializable
data class ChatRequest(
    val message: String,
    val conversationId: String? = null,
    val confirmedTools: List<String> = emptyList()
)

@Serializable
data class ApiSession(@SerialName("access_token") val accessToken: String? = null)

@Serializable
data class AuthResponse(val success: Boolean, val session: ApiSession? = null, val error: String? = null)

@Serializable
data class ChatResponse(val success: Boolean, val reply: String? = null, val conversationId: String? = null, val error: String? = null)

class JarvisApi(private val sessionStore: SessionStore) {
    private val client = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }
    private val mediaType = "application/json".toMediaType()

    suspend fun login(email: String, password: String): AuthResponse =
        post("/auth/login", json.encodeToString(AuthRequest.serializer(), AuthRequest(email, password)))

    suspend fun register(email: String, password: String): AuthResponse =
        post("/auth/register", json.encodeToString(AuthRequest.serializer(), AuthRequest(email, password)))

    suspend fun chat(message: String, conversationId: String? = null): ChatResponse =
        post("/chat", json.encodeToString(ChatRequest.serializer(), ChatRequest(message, conversationId)))

    suspend fun logout() {
        val request = Request.Builder().url(url("/auth/logout")).post("{}".toRequestBody(mediaType))
            .header("Authorization", "Bearer ${sessionStore.accessToken ?: ""}").build()
        client.newCall(request).execute().use { sessionStore.clear() }
    }

    private suspend inline fun <reified T> post(path: String, body: String): T {
        val request = Request.Builder().url(url(path)).post(body.toRequestBody(mediaType))
            .header("Authorization", "Bearer ${sessionStore.accessToken ?: ""}").build()
        return client.newCall(request).execute().use { response ->
            val raw = response.body?.string() ?: throw IOException("Empty backend response")
            if (!response.isSuccessful) throw IOException(json.decodeFromString<AuthResponse>(raw).error ?: "Backend request failed")
            json.decodeFromString(raw)
        }
    }

    private fun url(path: String) = "${BuildConfig.JARVIS_API_URL.trimEnd('/')}$path"
}
