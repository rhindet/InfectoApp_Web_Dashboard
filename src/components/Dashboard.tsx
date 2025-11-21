import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import ArticleList from './ArticleList';
import ArticleEditor from './ArticleEditor';
import ArticleView from './ArticleView';
import { Article, User } from '../types';
import { DriveNode, ModalMoveDialog } from './ModalArchives';
import ThemeCreator from './ThemeCreator';

// Tipo para las opciones de temas
type Option = { value: string; label: string };

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

/** --------- CACHÉ LOCAL --------- */
const CACHE_KEY = 'infecto_articles_cache_v1';

function loadCache(): Article[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCache(list: Article[]) {
  try {
    if (Array.isArray(list) && list.length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(list));
    }
    // si viene vacío, no lo guardamos para no “pisar” la caché previa buena
  } catch {}
}

function removeFromCache(id: string) {
  const current = loadCache();
  const filtered = current.filter(a => a._id !== id);
  if (filtered.length > 0) {
    saveCache(filtered);
  }
  return filtered;
}

/** Modal de éxito */
const SuccessModal: React.FC<{
  open: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  autoCloseMs?: number;
}> = ({ open, title = "¡Artículo creado!", message = "Se guardó correctamente en la ubicación seleccionada.", onClose, autoCloseMs = 5000 }) => {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [open, autoCloseMs, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/50 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[420px] max-w-[92vw] rounded-2xl shadow-xl overflow-hidden bg-white border border-emerald-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-3 flex items-start gap-4">
          <div className="shrink-0 mt-0.5">
            <div className="rounded-full p-2 bg-emerald-50">
              <CheckCircle2 className="text-emerald-600" size={28} />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-emerald-700">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
        </div>
        <div className="px-6 pb-6 pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
      <style>{`
        .animate-fadeIn { animation: fadeIn .18s ease-out; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeView, setActiveView] =
    useState<'articles' | 'add' | 'edit' | 'view' | 'addTopic'>('articles');

  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);

  // Para remonte limpio del editor
  const [editorKey, setEditorKey] = useState<number>(0);

  // Solo nivel 0 en la raíz
  const [dd1Options, setDd1Options] = useState<Option[]>([]);

  // Modal "Mover a…"
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false); // estado mientras hace POST
  const [pendingArticle, setPendingArticle] = useState<null | {
    _id?: string;
    tema: string;
    contenidos: string[];
    ref_tabla_nivel0?: string | null;
    ref_tabla_nivel1?: string | null;
    ref_tabla_nivel2?: string | null;
    ref_tabla_nivel3?: string | null;
  }>(null);

  // Modal de éxito
  const [successOpen, setSuccessOpen] = useState(false);

  // Flags de control
  const hasFetchedRef = useRef(false);
  const didMountRef = useRef(false);

  // Persistir en caché cuando cambien los artículos (solo si hay datos y no es el primer render)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (articles.length > 0) {
      saveCache(articles);
    }
  }, [articles]);

  // Carga inicial (con caché)
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;

    const fetchArticlesFirstTime = async () => {
      try {
        // 1) Intentar desde caché
        const cached = loadCache();
        if (cached.length > 0) {
          setArticles(cached);
          setLoading(false);
          return; // No llamar a la API si ya hay caché
        }

        // 2) Si no hay caché y tampoco hemos pedido en esta sesión, pedir a la API
        if (!hasFetchedRef.current) {
          const res = await fetch(`${apiUrl}/articles`);
          const json = await res.json();
          setArticles(json);
          saveCache(json);       // Guardar en caché si trajo datos
          hasFetchedRef.current = true;
        }
      } catch (err) {
        console.error('Error cargando artículos:', err);
      } finally {
        setLoading(false);
      }
    };

    const getTemas = async () => {
      try {
        const res = await fetch(`${apiUrl}/nivelesScraping/niveles/temas`);
        const json = await res.json();
        const opts0: Option[] = (json?.[0] ?? []).map((it: any) => ({ value: it._id, label: it.nombre }));
        setDd1Options(opts0);
      } catch (e) {
        console.error('Error cargando temas:', e);
      }
    };

    getTemas();
    fetchArticlesFirstTime();
  }, []);

  // Utils
  const optionToFolder = (levelPrefix: string) => (opt: Option, index?: number): DriveNode => ({
    id: `${levelPrefix}:${opt.value}`,
    name: opt.label,
    type: "folder",
    starred: index !== undefined ? index % 3 === 0 : false,
  });

  const parseFullId = (fullId: string) => {
    const [prefix, rawId] = fullId.split(':');
    const m = /^L(\d+)$/.exec(prefix ?? '');
    const level = m ? Number(m[1]) : null;
    return { level, rawId: rawId ?? '' };
  };

  /**
   * Loader de carpetas:
   * - raíz (null) => SOLO opts0
   * - click carpeta => hijos por API /nivelesScraping/:id/:nextLevel
   * - si no hay hijos => /articles/:id (id = última carpeta) y se muestran como archivos (file)
   */
  const loadChildren = useCallback(async (parentId: string | null): Promise<DriveNode[]> => {
    const apiUrl = import.meta.env.VITE_API_URL;

    if (parentId === null) {
      return dd1Options.map(optionToFolder('L0'));
    }

    const { level, rawId } = parseFullId(parentId);
    if (level === null || !rawId) return [];

    const nextLevel = level + 1;

    try {
      const res = await fetch(`${apiUrl}/nivelesScraping/${rawId}/${nextLevel}`);
      const json = await res.json();

      const childrenAsFolders: DriveNode[] = (Array.isArray(json) ? json : []).map((it: any) => ({
        id: `L${nextLevel}:${it._id}`,
        name: it.nombre ?? 'Sin nombre',
        type: 'folder',
        starred: false,
      }));

      console.log("childrenAsFolders",childrenAsFolders)

      if (childrenAsFolders.length > 0) return childrenAsFolders;

      const resArticles = await fetch(`${apiUrl}/articles/${rawId}`);
      const arts = await resArticles.json();

      const asFiles: DriveNode[] = (Array.isArray(arts) ? arts : []).map((a: Article) => ({
        id: `ART:${a._id ?? crypto.randomUUID()}`,
        name: a.tema ?? '(sin título)',
        type: 'file',
        starred: false,
      }));

      console.log("asFiles",childrenAsFolders)


      return asFiles;
    } catch (err) {
      console.error('Error cargando hijos/artículos:', err);
      return [];
    }
  }, [dd1Options]);

  // Guardar (crear/editar) desde el editor (sin POST aún si es creación)
  const handleSaveArticle = async (data: {
    _id?: string; tema: string; contenidos: string[];
    ref_tabla_nivel0?: string | null;
    ref_tabla_nivel1?: string | null;
    ref_tabla_nivel2?: string | null;
    ref_tabla_nivel3?: string | null;
  }) => {
    if (data._id) {
      // Edición local (editor sin POST)
      setArticles((prev) => {
        const updated = prev.map((a) => (a._id === data._id ? { ...a, ...data, updatedAt: new Date().toISOString() } as any : a));
        if (updated.length > 0) saveCache(updated);
        return updated;
      });
      setActiveView('articles');
      setCurrentArticle(null);
      return;
    }
    setPendingArticle(data);
    setOpen(true);
  };

  const handleUpdateArticle = async (data: {
    _id?: string; tema: string; contenidos: string[];
    ref_tabla_nivel0?: string | null;
    ref_tabla_nivel1?: string | null;
    ref_tabla_nivel2?: string | null;
    ref_tabla_nivel3?: string | null;
  }) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const res = await fetch(`${apiUrl}/nivelesScraping/actualizarArticulo/${data._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${txt}`);
      }

      const updated = await res.json();
      setArticles(prev => {
        const next = prev.map(a => (a._id === updated._id ? updated : a));
        if (next.length > 0) saveCache(next);
        return next;
      });

      resetToNewArticle();
      setSuccessOpen(true);
    } catch (e) {
      console.error('Error actualizando artículo:', e);
    } finally {
      setSaving(false);
    }
  };

  const resetToNewArticle = () => {
    setPendingArticle(null);
    setCurrentArticle(null);
    setEditorKey((k) => k + 1);
    setActiveView('add');
  };

  // Crear (POST) cuando eliges carpeta en el modal
  const handleMoveTo = async (target: { fullId: string; level: number | null; rawId: string }) => {
    if (!pendingArticle || saving) return;

    setSaving(true);
    const apiUrl = import.meta.env.VITE_API_URL;

    const rawId = target.rawId;
    const newArticle: Article = {
      tema: pendingArticle.tema,
      contenidos: pendingArticle.contenidos,
      ref_tabla_nivel0: target.level === 0 ? rawId : null,
      ref_tabla_nivel1: target.level === 1 ? rawId : null,
      ref_tabla_nivel2: target.level === 2 ? rawId : null,
      ref_tabla_nivel3: target.level === 3 ? rawId : null,
    } as any;

    try {
      const res = await fetch(`${apiUrl}/nivelesScraping/crearArticulo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newArticle),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${txt}`);
      }

      const created: Article = await res.json();

      setArticles((prev) => {
        const next = [...prev, created];
        if (next.length > 0) saveCache(next);
        return next;
      });

      setOpen(false);
      resetToNewArticle();
      setSuccessOpen(true);
    } catch (e) {
      console.error('Error creando artículo:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleEditArticle = (article: Article) => {
    setCurrentArticle(article);
    setActiveView('edit');
  };

  const handleViewArticle = (article: Article) => {
    setCurrentArticle(article);
    setActiveView('view');
  };

  // Eliminar (optimista)
  const handleDeleteArticle = async (id: string) => {
    const apiUrl = import.meta.env.VITE_API_URL;

    if (!window.confirm('¿Eliminar este artículo?')) return;

    setArticles(prev => {
      const next = prev.filter(a => a._id !== id);
      if (next.length > 0) saveCache(next); // si queda vacío, NO guardamos []
      return next;
    });

    try {
      const res = await fetch(`${apiUrl}/articles/delete/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${txt}`);
      }

      setSuccessOpen(true);
    } catch (e) {
      console.error('Error eliminando artículo (revirtiendo caché):', e);
      const cached = loadCache();
      if (cached.length > 0) setArticles(cached);
    }
  };

  const handleAddArticle = () => {
    resetToNewArticle();
  };

  const renderContent = () => {
    switch (activeView) {
      case 'articles':
        return (
          <ArticleList
            articles={articles}
            onEdit={handleEditArticle}
            onDelete={handleDeleteArticle}
            onView={handleViewArticle}
            onAdd={handleAddArticle}
          />
        );
      case 'add':
      case 'edit':
        return (
          <ArticleEditor
            key={editorKey}
            article={currentArticle || undefined}
            onSave={handleSaveArticle}
            onUpdate={handleUpdateArticle}
            onCancel={() => setActiveView('articles')}
          />
        );
      case 'view':
        return currentArticle ? (
          <ArticleView
            article={currentArticle}
            onBack={() => setActiveView('articles')}
            onEdit={handleEditArticle}
          />
        ) : null;

      case 'addTopic':
        return (
          <ThemeCreator
            key={editorKey}
            article={currentArticle || undefined}
            onSave={handleSaveArticle}
            onUpdate={handleUpdateArticle}
            onCancel={() => setActiveView('articles')}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        activeView={
          activeView === 'add' || activeView === 'edit'
            ? 'add'
            : activeView === 'addTopic'
            ? 'addTopic'
            : 'articles'
        }
        onViewChange={(view) => {
          if (view === 'add') {
            handleAddArticle();
            setActiveView('add');
          } else if (view === 'addTopic') {
            setActiveView('addTopic');
          } else if (view === 'articles') {
            // NO sobrescribas con caché vacía
            if (articles.length === 0) {
              const cached = loadCache();
              if (cached.length > 0) setArticles(cached);
            }
            setActiveView('articles');
          }
        }}
      />

      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-800">Dashboard de Investigación</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Bienvenido, {user.username}</span>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">{loading ? 'Cargando…' : renderContent()}</div>
      </div>

      {/* Modal “Mover a…” */}
       <ModalMoveDialog
        mode={activeView === 'addTopic' ? 'topic' : 'move'}   // 👈 ESTE PROP NUEVO
        isOpen={open}
        itemName={pendingArticle?.tema ?? 'Nuevo artículo'}
        onClose={() => {
          if (!saving) {
            setOpen(false);
            setPendingArticle(null);
          }
        }}
        onMove={handleMoveTo}
        loadChildren={loadChildren}
        rootId={null}
      />

      {/* Modal de éxito */}
      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="¡Acción exitosa!"
        message="Cambios aplicados y sincronizados con la caché local."
      />
    </div>
  );
};

export default Dashboard;