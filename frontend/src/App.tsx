import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "./lib/api";
import type { Conversation, Memory, Message } from "./lib/api";
import { supabase } from "./lib/supabase";
import { useVoiceInteraction } from "./voice/use-voice-interaction";
import type { VoiceState } from "./voice/voice.types";

type View = "chat" | "history" | "memory" | "drive" | "settings";
type AuthMode = "login" | "register";
type User = { id: string; email?: string };

const icons: Record<string, string> = {
    chat: "◈", history: "◷", memory: "✦", drive: "⌁", settings: "⚙"
};

function AuthScreen({ mode, setMode, onAuthenticated }: { mode: AuthMode; setMode: (m: AuthMode) => void; onAuthenticated: (user: User) => void }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const submit = async (event: FormEvent) => {
        event.preventDefault(); setBusy(true); setError("");
        try {
            if (!supabase) throw new Error("Supabase is not configured. Add the VITE_SUPABASE variables.");
            const result = mode === "login"
                ? await supabase.auth.signInWithPassword({ email, password })
                : await supabase.auth.signUp({ email, password });
            if (result.error) throw result.error;
            if (!result.data.user) throw new Error("Authentication did not return a user.");
            onAuthenticated({ id: result.data.user.id, email: result.data.user.email });
        } catch (e) { setError(e instanceof Error ? e.message : "Unable to authenticate"); }
        finally { setBusy(false); }
    };
    return <main className="auth-shell">
        <div className="auth-visual"><span className="eyebrow">PERSONAL INTELLIGENCE / 01</span><h1>Think clearly.<br /><em>Move deliberately.</em></h1><p>JARVISE brings your conversations, memory, and knowledge into one calm workspace.</p><div className="orb" /></div>
        <form className="auth-card" onSubmit={submit}>
            <div className="brand"><span className="brand-mark">J</span><span>JARVISE</span></div>
            <span className="eyebrow">{mode === "login" ? "WELCOME BACK" : "START YOUR WORKSPACE"}</span>
            <h2>{mode === "login" ? "Sign in to JARVISE" : "Create your account"}</h2>
            <p className="muted">{mode === "login" ? "Your private thinking space is ready." : "A secure home for your ideas and context."}</p>
            {error && <div className="alert error" role="alert">{error}</div>}
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} value={password} onChange={e => setPassword(e.target.value)} required /></label>
            <button className="button primary wide" disabled={busy}>{busy ? "Connecting…" : mode === "login" ? "Enter workspace" : "Create workspace"} <span>→</span></button>
            <button type="button" className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "New to JARVISE? Create an account" : "Already have an account? Sign in"}</button>
            <small className="legal">By continuing, you agree to keep your workspace secure. JARVISE never stores your password.</small>
        </form>
    </main>;
}

function Sidebar({ view, setView, user, onLogout }: { view: View; setView: (v: View) => void; user: User; onLogout: () => void }) {
    return <aside className="sidebar">
        <div className="brand"><span className="brand-mark">J</span><span>JARVISE</span></div>
        <div className="side-label">WORKSPACE</div>
        <nav>{(["chat", "history", "memory", "drive"] as View[]).map(item => <button key={item} className={view === item ? "nav-item active" : "nav-item"} onClick={() => setView(item)}><span className="nav-icon">{icons[item]}</span>{item === "chat" ? "JARVIS chat" : item[0].toUpperCase() + item.slice(1)}{item === "chat" && <span className="live-dot" />}</button>)}</nav>
        <div className="sidebar-bottom"><button className={view === "settings" ? "nav-item active" : "nav-item"} onClick={() => setView("settings")}><span className="nav-icon">{icons.settings}</span>Settings</button><div className="profile"><span className="avatar">{(user.email || "U")[0].toUpperCase()}</span><span><strong>{user.email?.split("@")[0] || "You"}</strong><small>Personal workspace</small></span><button aria-label="Sign out" onClick={onLogout}>↗</button></div></div>
    </aside>;
}

function VoiceControl({ state, error, onStart, onStop }: { state: VoiceState; error: string; onStart: () => void; onStop: () => void }) {
    const active = state === "listening" || state === "processing" || state === "speaking";
    const label = state === "listening" ? "Listening…" : state === "processing" ? "Processing…" : state === "speaking" ? "Speaking…" : state === "error" ? "Voice error" : "Use voice";
    return <div className="voice-control"><button type="button" className={`voice-button ${active ? "active" : ""} ${state === "error" ? "has-error" : ""}`} onClick={active ? onStop : onStart} aria-label={label} aria-pressed={active}><span className="voice-glyph">{active ? "■" : "●"}</span></button><span className={`voice-state ${state}`}>{label}</span>{error && <span className="voice-error" role="alert">{error}</span>}</div>;
}

function Chat({ onToolPrompt }: { onToolPrompt: () => void }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const sendText = useCallback(async (text: string): Promise<string> => {
        if (!text.trim() || busy) return "";
        setDraft(""); setError(""); setMessages(m => [...m, { id: crypto.randomUUID(), role: "user", content_text: text, created_at: new Date().toISOString() }]); setBusy(true);
        try {
            const result = await api.chat(text);
            setMessages(m => [...m, { id: crypto.randomUUID(), role: "assistant", content_text: result.reply, created_at: new Date().toISOString() }]);
            return result.reply;
        } catch (e) {
            const message = e instanceof Error ? e.message : "JARVIS could not respond.";
            setError(message); throw new Error(message);
        } finally { setBusy(false); }
    }, [busy]);
    const voice = useVoiceInteraction(sendText);
    const send = async (event?: FormEvent) => { event?.preventDefault(); if (draft.trim()) await sendText(draft.trim()); };
    return <section className="chat-layout"><header className="page-header"><div><span className="eyebrow">YOUR THINKING PARTNER</span><h1>Good evening.</h1><p className="muted">What would you like to work through?</p></div><button className="icon-button" onClick={onToolPrompt} aria-label="View security permissions">♢</button></header><div className="chat-stream">{messages.length === 0 && <div className="welcome"><div className="welcome-symbol">✦</div><h2>Where should we begin?</h2><p>Ask me to find a memory, search your Drive knowledge, or think alongside you.</p><div className="suggestions"><button onClick={() => setDraft("What do you remember about my current goals?")}>Recall my goals <span>↗</span></button><button onClick={() => setDraft("What time is it?")}>Check the time <span>↗</span></button></div></div>}{messages.map(m => <div key={m.id} className={`message ${m.role}`}><span className="message-label">{m.role === "assistant" ? "JARVIS" : "YOU"}</span><p>{m.content_text}</p></div>)}{busy && <div className="message assistant"><span className="message-label">JARVIS</span><p className="typing"><i /><i /><i /></p></div>}{error && <div className="alert error">{error}</div>}</div><form className="composer" onSubmit={send}><textarea aria-label="Message JARVIS" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Ask JARVIS anything…" rows={1} /><div className="composer-actions"><VoiceControl state={voice.state} error={voice.error} onStart={voice.startListening} onStop={voice.stop} /><button className="send-button" disabled={busy || !draft.trim()} aria-label="Send message">↑</button></div><small>↵ to send · shift ↵ for new line</small></form></section>;
}

function History({ onOpen }: { onOpen: (id: string) => void }) {
    const [items, setItems] = useState<Conversation[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
    useEffect(() => { api.conversations().then(r => setItems(r.conversations)).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
    return <Page title="Conversation history" eyebrow="YOUR THREADS" subtitle="Return to a thought whenever you need it."><div className="list-card">{loading ? <Loading /> : error ? <Empty title="Could not load conversations" text={error} /> : items.length ? items.map(c => <button className="list-row" key={c.id} onClick={() => onOpen(c.id)}><span className="row-icon">◈</span><span><strong>{c.title || "Untitled conversation"}</strong><small>{c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : "No messages yet"}</small></span><span className="row-arrow">→</span></button>) : <Empty title="Your history is empty" text="Start a conversation with JARVIS and it will appear here." />}</div></Page>;
}

function Memory() {
    const [items, setItems] = useState<Memory[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
    useEffect(() => { api.memories().then(r => setItems(r.memories)).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
    const remove = async (id: string) => { try { await api.deleteMemory(id); setItems(items.filter(x => x.id !== id)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to delete memory"); } };
    return <Page title="Memory" eyebrow="YOUR CONTEXT" subtitle="A transparent, editable record of what JARVIS knows about you.">
        <div className="memory-toolbar"><span className="chip">All memories</span><span className="muted">{items.length} saved</span></div>
        {loading ? <Loading /> : error ? <div className="alert error">{error}</div> : items.length ? (
            <div className="memory-grid">{items.map(m => (
                <article className="memory-card" key={m.id}>
                    <div className="card-top"><span className="tag">{m.memory_type.replace("_", " ")}</span><button onClick={() => void remove(m.id)} aria-label="Delete memory">×</button></div>
                    <p>{m.content}</p><small>Updated {new Date(m.updated_at).toLocaleDateString()}</small>
                </article>
            ))}</div>
        ) : <Empty title="Nothing saved yet" text="When something is worth remembering, JARVIS will ask before saving it." />}
    </Page>;
}

function Drive() {
    const [files, setFiles] = useState<Array<{ id: string; name: string; mimeType: string; modifiedTime: string }>>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
    const load = () => { setLoading(true); api.driveFiles().then(r => setFiles(r.files)).catch(e => setError(e.message)).finally(() => setLoading(false)); }; useEffect(load, []);
    const connect = async () => { try { const r = await api.driveConnect(); window.location.href = r.authorizationUrl; } catch (e) { setError(e instanceof Error ? e.message : "Unable to connect Google Drive"); } };
    return <Page title="Drive knowledge" eyebrow="CONNECTED SOURCES" subtitle="Bring your documents into the conversation without losing control."><div className="drive-banner"><div><span className="eyebrow">GOOGLE DRIVE</span><h3>Connect your knowledge base</h3><p className="muted">JARVISE indexes only supported documents and keeps your source ownership intact.</p></div><button className="button primary" onClick={connect}>Connect Drive <span>↗</span></button></div>{error && <div className="alert error">{error}</div>}{loading ? <Loading /> : files.length ? <div className="list-card">{files.map(file => <div className="list-row" key={file.id}><span className="row-icon">□</span><span><strong>{file.name}</strong><small>{file.mimeType} · Updated {new Date(file.modifiedTime).toLocaleDateString()}</small></span></div>)}</div> : <Empty title="No connected files" text="Connect Google Drive to let JARVIS search your supported documents." />}</Page>;
}

function Settings({ user, onLogout }: { user: User; onLogout: () => void }) {
    const [saved, setSaved] = useState(false); const [name, setName] = useState(""); const save = async () => { try { await api.savePreferences({ display_name: name }); setSaved(true); setTimeout(() => setSaved(false), 2200); } catch { setSaved(false); } };
    return <Page title="Settings" eyebrow="CONTROL CENTER" subtitle="Manage your account, privacy, and permission boundaries."><div className="settings-grid"><section className="settings-card"><span className="eyebrow">PROFILE</span><h3>Your workspace</h3><label>Display name<input value={name} onChange={e => setName(e.target.value)} placeholder={user.email?.split("@")[0]} /></label><label>Email address<input value={user.email || ""} disabled /></label><button className="button secondary" onClick={() => void save}>{saved ? "Saved ✓" : "Save changes"}</button></section><section className="settings-card security-card"><span className="eyebrow">SECURITY & PERMISSIONS</span><h3>Your approval is required</h3><p className="muted">JARVISE will never let an AI decision authorize an action by itself.</p><div className="permission-line"><span className="permission-icon read">R</span><span><strong>Read actions</strong><small>Search your memory and connected knowledge</small></span><b>Allowed</b></div><div className="permission-line"><span className="permission-icon confirm">!</span><span><strong>Write & sensitive actions</strong><small>Always require your explicit confirmation</small></span><b>Ask first</b></div><div className="permission-line"><span className="permission-icon lock">⌁</span><span><strong>Secrets & passwords</strong><small>Never stored as AI memory</small></span><b>Protected</b></div></section></div><button className="button danger-outline" onClick={onLogout}>Sign out of JARVISE</button></Page>;
}

function Page({ title, eyebrow, subtitle, children }: { title: string; eyebrow: string; subtitle: string; children: React.ReactNode }) { return <section className="page"><header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="muted">{subtitle}</p></div></header>{children}</section>; }
function Loading() { return <div className="loading" aria-label="Loading"><span /><span /><span /></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><div className="empty-mark">✦</div><h3>{title}</h3><p>{text}</p></div>; }

export default function App() {
    const [user, setUser] = useState<User | null>(null); const [authMode, setAuthMode] = useState<AuthMode>("login"); const [view, setView] = useState<View>("chat"); const [permissionPrompt, setPermissionPrompt] = useState(false);
    useEffect(() => { if (!supabase) return; supabase.auth.getUser().then(({ data }) => { if (data.user) setUser({ id: data.user.id, email: data.user.email }); }); const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)); return () => data.subscription.unsubscribe(); }, []);
    const logout = async () => { if (supabase) await supabase.auth.signOut(); setUser(null); };
    if (!user) return <AuthScreen mode={authMode} setMode={setAuthMode} onAuthenticated={setUser} />;
    return <div className="app-shell"><Sidebar view={view} setView={setView} user={user} onLogout={() => void logout()} /><main className="main-content"><div className="mobile-brand"><span className="brand-mark">J</span> JARVISE</div>{view === "chat" && <Chat onToolPrompt={() => setPermissionPrompt(true)} />}{view === "history" && <History onOpen={() => setView("chat")} />}{view === "memory" && <Memory />}{view === "drive" && <Drive />}{view === "settings" && <Settings user={user} onLogout={() => void logout()} />}</main>{permissionPrompt && <div className="modal-backdrop" onClick={() => setPermissionPrompt(false)}><div className="permission-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setPermissionPrompt(false)}>×</button><span className="eyebrow">SECURITY BY DESIGN</span><h2>You stay in control.</h2><p className="muted">Read-only tools can search your approved sources. Any future write, destructive, or sensitive action will pause and ask you first.</p><div className="modal-rule"><span>✓</span> Backend-enforced permissions</div><div className="modal-rule"><span>✓</span> No passwords or API keys in memory</div><button className="button primary wide" onClick={() => setPermissionPrompt(false)}>Got it</button></div></div>}</div>;
}
