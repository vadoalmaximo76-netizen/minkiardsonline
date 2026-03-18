import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { AVATARS } from "../lib/avatars";
import { useAudio } from "../lib/stores/useAudio";

interface AuthDialogProps {
  open: boolean;
  onSuccess: (user: { id: number; username: string; email: string | null; avatar: string | null; isGuest?: boolean }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export const AuthDialog: React.FC<AuthDialogProps> = ({ open, onSuccess }) => {
  const { playModalOpen, playButtonClick, playConfirm } = useAudio();
  const [mode, setMode] = useState<"login" | "register" | "guest" | "forgot-password">("login");
  const [email, setEmail] = useState(() => localStorage.getItem("lastEmail") || "");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [guestName, setGuestName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      playModalOpen();
      fetch("/api/auth/google-client-id")
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.clientId) setGoogleClientId(data.clientId); })
        .catch(() => {});
    }
  }, [open]);

  const handleGoogleCallback = async (response: any) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: response.credential,
          avatar: selectedAvatar
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore durante l'autenticazione");
      }

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userId", data.user.id.toString());
      localStorage.setItem("userEmail", data.user.email || "");
      localStorage.setItem("userAvatar", data.user.avatar || "dragon");
      if (data.user.email) localStorage.setItem("lastEmail", data.user.email);

      onSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    playButtonClick();
    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { email, password }
        : { email, password, username, avatar: selectedAvatar };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore durante l'autenticazione");
      }

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userId", data.user.id.toString());
      localStorage.setItem("userEmail", data.user.email || "");
      localStorage.setItem("userAvatar", data.user.avatar || "dragon");
      localStorage.setItem("lastEmail", email);

      playConfirm();
      onSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!guestName.trim()) {
      setError("Inserisci un nome per continuare");
      return;
    }

    if (guestName.trim().length < 2) {
      setError("Il nome deve avere almeno 2 caratteri");
      return;
    }

    const guestUser = {
      id: -1,
      username: guestName.trim(),
      email: null,
      avatar: null,
      isGuest: true,
      puntiRankiard: 0
    };

    localStorage.removeItem("authToken");
    localStorage.setItem("isGuest", "true");
    localStorage.setItem("guestName", guestName.trim());

    onSuccess(guestUser);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore durante il recupero password");
      }

      setSuccessMessage(data.message || "Email inviata con successo!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 bg-black/40 border border-violet-500/20 text-violet-100 placeholder:text-violet-300/40 rounded-xl focus:outline-none focus:border-violet-400/60 transition-colors";
  const primaryBtn = "w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)]";
  const linkBtn = "text-violet-400 hover:text-violet-300 text-sm underline transition-colors";

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md bg-black/90 backdrop-blur-xl border border-violet-500/30 shadow-[0_0_40px_rgba(124,58,237,0.3)] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-black bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            {mode === "login" ? "Accedi a MINKIARDS" :
             mode === "register" ? "Registrati a MINKIARDS" :
             mode === "forgot-password" ? "Recupera Password" :
             "Entra come Ospite"}
          </DialogTitle>
        </DialogHeader>

        {/* Forgot password form */}
        {mode === "forgot-password" ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="text-violet-300/70 text-sm mb-4">
              Inserisci la tua email e ti invieremo le istruzioni per reimpostare la password.
            </div>

            <div>
              <label className="text-violet-300/80 block mb-2 text-sm font-semibold">Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="email@esempio.com"
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-500/20 p-2 rounded-xl">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="text-emerald-400 text-sm text-center bg-emerald-900/20 border border-emerald-500/20 p-2 rounded-xl">
                {successMessage}
              </div>
            )}

            <button type="submit" className={primaryBtn} disabled={loading}>
              {loading ? "Invio in corso..." : "INVIA EMAIL DI RECUPERO"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }}
                className={linkBtn}
              >
                Torna al login
              </button>
            </div>
          </form>
        ) : mode === "guest" ? (
          <form onSubmit={handleGuestEntry} className="space-y-4">
            <div>
              <label className="text-violet-300/80 block mb-2 text-sm font-semibold">Il tuo nome:</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className={inputClass}
                placeholder="Inserisci il tuo nome"
                maxLength={20}
                autoFocus
              />
            </div>

            <div className="bg-orange-900/20 border border-orange-500/20 p-3 rounded-xl text-orange-300 text-sm">
              <p className="font-bold mb-1">Nota:</p>
              <p>Entrando senza registrazione non avrai accesso a:</p>
              <ul className="list-disc list-inside mt-1 text-orange-300/80">
                <li>Avatar personalizzato</li>
                <li>Punti Rankiard</li>
              </ul>
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-500/20 p-2 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-orange-700 to-amber-700 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl transition-all"
            >
              ENTRA COME OSPITE
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className={linkBtn}
              >
                Torna al login
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="text-violet-300/80 block mb-2 text-sm font-semibold">Nome utente:</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClass}
                    placeholder="Il tuo nome"
                    maxLength={20}
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-violet-300/80 block mb-2 text-sm font-semibold">Email:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="email@esempio.com"
                  required
                />
              </div>

              <div>
                <label className="text-violet-300/80 block mb-2 text-sm font-semibold">Password:</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder={mode === "register" ? "Minimo 6 caratteri" : "La tua password"}
                  minLength={mode === "register" ? 6 : undefined}
                  required
                />
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => { setMode("forgot-password"); setError(""); setSuccessMessage(""); }}
                    className="text-violet-400 hover:text-violet-300 text-xs mt-1 underline"
                  >
                    Password dimenticata?
                  </button>
                )}
              </div>

              {mode === "register" && (
                <div>
                  <label className="text-violet-300/80 block mb-2 text-sm font-semibold">Scegli il tuo avatar:</label>
                  <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto p-2 bg-black/30 rounded-xl border border-violet-500/10">
                    {AVATARS.map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setSelectedAvatar(avatar.id)}
                        className={`
                          w-9 h-9 flex items-center justify-center rounded-lg text-lg
                          transition-all duration-200 hover:scale-110
                          ${selectedAvatar === avatar.id
                            ? 'bg-violet-600/70 ring-2 ring-violet-400 shadow-[0_0_10px_rgba(124,58,237,0.5)]'
                            : 'bg-white/5 hover:bg-violet-900/40'
                          }
                        `}
                        title={avatar.name}
                      >
                        {avatar.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-500/20 p-2 rounded-xl">
                  {error}
                </div>
              )}

              <button type="submit" className={primaryBtn} disabled={loading}>
                {loading ? "Caricamento..." : mode === "login" ? "ACCEDI" : "REGISTRATI"}
              </button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-violet-500/15"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-black/90 text-violet-400/50">oppure</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setMode("guest"); setError(""); }}
              className="w-full py-3 bg-gradient-to-r from-orange-700 to-amber-700 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl transition-all"
            >
              ENTRA SENZA REGISTRAZIONE
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
                className={linkBtn}
              >
                {mode === "login"
                  ? "Non hai un account? Registrati"
                  : "Hai già un account? Accedi"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
