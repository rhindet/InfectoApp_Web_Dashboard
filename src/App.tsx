import React, { useEffect, useState } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import { User } from "./types";

const STORAGE_KEY = "app_user";

function App() {
  const [user, setUser] = useState<User | null>(null);

  // ✅ Al cargar la app, recuperar sesión
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as User;
      if (parsed?.isAuthenticated) setUser(parsed);
    } catch {
      // si está corrupto, lo borras
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const handleLogin = (username: string, password: string) => {
    if (!username || !password) return;

    const nextUser: User = { username, isAuthenticated: true };
    setUser(nextUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser)); // ✅ persistir
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY); // ✅ limpiar
  };

  return (
    <div className="App">
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;