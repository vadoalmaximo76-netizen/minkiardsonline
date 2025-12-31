import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { AVATARS } from "../lib/avatars";

interface AuthDialogProps {
  open: boolean;
  onSuccess: (user: { id: number; username: string; email: string | null; avatar: string | null }) => void;
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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google && process.env.GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: process.env.GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        });
        
        const googleBtnContainer = document.getElementById("google-btn");
        if (googleBtnContainer) {
          window.google.accounts.id.renderButton(googleBtnContainer, {
            theme: "outline",
            size: "large",
            width: "100%",
            text: "continue_with",
          });
        }
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [open]);

  const handleGoogleResponse = async (response: { credential: string }) => {
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

      localStorage.setItem("userId", data.user.id.toString());
      localStorage.setItem("userEmail", data.user.email || "");
      localStorage.setItem("userAvatar", data.user.avatar || "dragon");
      
      onSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
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

      localStorage.setItem("userId", data.user.id.toString());
      localStorage.setItem("userEmail", data.user.email || "");
      localStorage.setItem("userAvatar", data.user.avatar || "dragon");
      
      onSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md bg-gray-800 border-gray-600 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-center text-2xl">
            {mode === "login" ? "Accedi a MINKIARDS" : "Registrati a MINKIARDS"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="text-white block mb-2">Nome utente:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border-0 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Il tuo nome"
                maxLength={20}
                required
              />
            </div>
          )}

          <div>
            <label className="text-white block mb-2">Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border-0 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="email@esempio.com"
              required
            />
          </div>

          <div>
            <label className="text-white block mb-2">Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border-0 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder={mode === "register" ? "Minimo 6 caratteri" : "La tua password"}
              minLength={mode === "register" ? 6 : undefined}
              required
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="text-white block mb-2">Scegli il tuo avatar:</label>
              <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto p-2 bg-gray-700 rounded">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar.id)}
                    className={`
                      w-9 h-9 flex items-center justify-center rounded-lg text-lg
                      transition-all duration-200 hover:scale-110
                      ${selectedAvatar === avatar.id 
                        ? 'bg-purple-600 ring-2 ring-white shadow-lg' 
                        : 'bg-gray-600 hover:bg-gray-500'
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
            <div className="text-red-400 text-sm text-center bg-red-900/30 p-2 rounded">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
            disabled={loading}
          >
            {loading ? "Caricamento..." : mode === "login" ? "ACCEDI" : "REGISTRATI"}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-800 text-gray-400">oppure</span>
          </div>
        </div>

        <div id="google-btn" className="flex justify-center"></div>
        
        {!process.env.GOOGLE_CLIENT_ID && (
          <p className="text-gray-500 text-xs text-center">
            Accesso Google non configurato
          </p>
        )}

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            className="text-purple-400 hover:text-purple-300 text-sm underline"
          >
            {mode === "login" 
              ? "Non hai un account? Registrati" 
              : "Hai già un account? Accedi"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
