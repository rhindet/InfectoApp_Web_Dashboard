import React, { useState } from "react";
import { User, Lock } from "lucide-react";

interface LoginProps {
  onLogin: (username: string, password: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoading(true);
    setTimeout(() => {
      onLogin(username, password);
      setIsLoading(false);
    }, 900);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="min-h-dvh grid lg:grid-cols-2">
        {/* LEFT IMAGE (desktop only) */}
        <div className="hidden lg:block relative overflow-hidden">
          <img
            src="https://images.pexels.com/photos/4167544/pexels-photo-4167544.jpeg?auto=compress&cs=tinysrgb&w=1600&h=1200"
            alt="Medical"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-blue-900/40" />

          {/* Branding */}
          <div className="relative z-10 h-full flex flex-col justify-between p-10 text-white">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white text-blue-700 font-black text-xl grid place-items-center shadow">
                IN
              </div>
              <div>
                <div className="text-xl font-bold tracking-wide">
                  INFECTOLOGÍA
                </div>
                <div className="text-sm text-white/80">
                  Gestión de Investigación
                </div>
              </div>
            </div>

            <div className="max-w-md">
              <h2 className="text-4xl font-semibold leading-tight">
                Panel de gestión científica
              </h2>
              <p className="mt-4 text-white/80">
                Organiza artículos, temas y contenido de investigación clínica
                de forma centralizada.
              </p>
            </div>

            <div className="text-sm text-white/70">
              © {new Date().getFullYear()} Infectología
            </div>
          </div>
        </div>

        {/* RIGHT FORM */}
        <div className="flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            {/* Branding (mobile + desktop form) */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-black text-xl grid place-items-center shadow">
                IN
              </div>
              <h1 className="mt-4 text-2xl font-bold text-gray-900">
                INFECTOLOGÍA
              </h1>
              <p className="text-gray-600 text-sm">
                Gestión de Investigación
              </p>
            </div>

            {/* Card */}
            <div className="bg-white/80 backdrop-blur border rounded-2xl shadow-sm p-6 sm:p-7">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Bienvenido
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Inicia sesión para continuar
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {/* Usuario */}
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                {/* Contraseña */}
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading || !username || !password}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
                </button>
              </form>

              {/* Demo */}
              <div className="mt-6 text-center text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
                <strong>Demo:</strong> admin / admin
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-gray-500 lg:hidden">
              © {new Date().getFullYear()} Infectología
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;