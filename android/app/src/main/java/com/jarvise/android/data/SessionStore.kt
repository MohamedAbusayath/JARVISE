package com.jarvise.android.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SessionStore(context: Context) {
    private val preferences = EncryptedSharedPreferences.create(
        context,
        "jarvise_session",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    var accessToken: String?
        get() = preferences.getString("access_token", null)
        private set(value) {
            preferences.edit().putString("access_token", value).apply()
        }

    fun save(accessToken: String) {
        this.accessToken = accessToken
    }

    fun clear() {
        preferences.edit().clear().apply()
    }
}
