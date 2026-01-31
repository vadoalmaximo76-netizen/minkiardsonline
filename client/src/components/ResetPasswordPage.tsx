import React, { useState } from "react";
import { Button } from "./ui/button";

interface ResetPasswordPageProps {
  token: string;
  onComplete: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ token, onComplete }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("La password deve essere di almeno 6 caratteri");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Le password non corrispondono");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore durante il reset della password");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-white mb-4">Password Reimpostata!</h1>
          <p className="text-gray-300 mb-6">
            La tua password è stata reimpostata con successo. Ora puoi accedere con la nuova password.
          </p>
          <Button
            onClick={onComplete}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
          >
            TORNA AL LOGIN
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-white text-center mb-6">
          Reimposta Password
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white block mb-2">Nuova Password:</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border-0 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Minimo 6 caratteri"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-white block mb-2">Conferma Password:</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border-0 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Ripeti la nuova password"
              required
            />
          </div>

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
            {loading ? "Reimpostazione in corso..." : "REIMPOSTA PASSWORD"}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={onComplete}
              className="text-purple-400 hover:text-purple-300 text-sm underline"
            >
              Torna al login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
