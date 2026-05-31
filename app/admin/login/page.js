"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";

export default function LoginAdmin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const ingresar = async () => {
    setCargando(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setCargando(false);

    if (error) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }

    router.push("/admin");
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md space-y-4">
        <div className="text-center space-y-3">
          <img
            src="/logo.png"
            alt="Laboral Salud"
            className="h-20 mx-auto object-contain"
          />

          <h1 className="text-2xl font-bold text-slate-800">
            Ingreso Administración
          </h1>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Email
          </label>

          <input
            className="w-full border-2 border-slate-700 rounded-xl p-3 text-slate-950 placeholder:text-slate-700 bg-white font-medium"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="recepcion@empresa.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Contraseña
          </label>

          <input
            className="w-full border-2 border-slate-700 rounded-xl p-3 text-slate-950 placeholder:text-slate-700 bg-white font-medium"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={ingresar}
          disabled={!email || !password || cargando}
          className="w-full bg-slate-900 text-white rounded-xl p-3 disabled:bg-slate-300"
        >
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
        <div className="bg-slate-50 border rounded-xl p-3 text-sm text-slate-600">
          Si olvidó su contraseña, solicite el restablecimiento al administrador general
          por mail o WhatsApp.
        </div>
      </div>
    </main>
  );
}