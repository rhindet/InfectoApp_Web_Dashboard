import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import ArticleList from './ArticleList';
import ArticleEditor from './ArticleEditor';
import ArticleView from './ArticleView';
import { Article, User } from '../types';
import { DriveNode, ModalMoveDialog } from './ModalArchives';

// Tipo para las opciones de temas
type Option = { value: string; label: string };

interface DashboardProps {
  user: User;
  onLogout: () => void;
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
      {/* animaciones tailwind opcionales */}
      <style>{`
        .animate-fadeIn { animation: fadeIn .18s ease-out; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeView, setActiveView] = useState<'articles' | 'add' | 'edit' | 'view'>('articles');
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

  // Carga inicial
  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const res = await fetch(`${apiUrl}/articles`);
        const json = await res.json();
        setArticles(json);
      } catch (err) {
        console.error('Error cargando datos:', err);
      } finally {
        setLoading(false);
      }
    };

    const getTemas = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const res = await fetch(`${apiUrl}/nivelesScraping/niveles/temas`);
        const json = await res.json();
        // Solo raíz (nivel 0)
        const opts0: Option[] = (json?.[0] ?? []).map((it: any) => ({ value: it._id, label: it.nombre }));
        setDd1Options(opts0);
      } catch (e) {
        console.error('Error cargando temas:', e);
      }
    };

    getTemas();
    fetchData();
  }, []);

  // Utils
  const optionToFolder = (levelPrefix: string) => (opt: Option, index?: number): DriveNode => ({
    id: `${levelPrefix}:${opt.value}`,
    name: opt.label,
    type: "folder",
    starred: index !== undefined ? index % 3 === 0 : false,
  });

  const parseFullId = (fullId: string) => {
    // fullId: "L<number>:<mongoId>"
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

    // 1) raíz: solo opciones de nivel 0
    if (parentId === null) {
      return dd1Options.map(optionToFolder('L0'));
    }

    // 2) carpeta clickeada: parsear nivel e id
    const { level, rawId } = parseFullId(parentId);
    if (level === null || !rawId) return [];

    const nextLevel = level + 1; // L0 -> 1, L1 -> 2, etc

    try {
      // hijos (subcarpetas) de esta carpeta
      const res = await fetch(`${apiUrl}/nivelesScraping/${rawId}/${nextLevel}`);
      const json = await res.json();

      const childrenAsFolders: DriveNode[] = (Array.isArray(json) ? json : []).map((it: any) => ({
        id: `L${nextLevel}:${it._id}`,
        name: it.nombre ?? 'Sin nombre',
        type: 'folder',
        starred: false,
      }));

      if (childrenAsFolders.length > 0) {
        return childrenAsFolders;
      }

      // hoja → trae artículos de esa carpeta
      const resArticles = await fetch(`${apiUrl}/articles/${rawId}`);
      const arts = await resArticles.json();

      const asFiles: DriveNode[] = (Array.isArray(arts) ? arts : []).map((a: Article) => ({
        id: `ART:${a._id ?? crypto.randomUUID()}`,
        name: a.tema ?? '(sin título)',
        type: 'file',
        starred: false,
      }));

      return asFiles;
    } catch (err) {
      console.error('Error cargando hijos/artículos:', err);
      return [];
    }
  }, [dd1Options]);

  // Guardar (crear/editar)
  const handleSaveArticle = async (data: {
    _id?: string; tema: string; contenidos: string[];
    ref_tabla_nivel0?: string | null;
    ref_tabla_nivel1?: string | null;
    ref_tabla_nivel2?: string | null;
    ref_tabla_nivel3?: string | null;
  }) => {
    if (data._id) {
      setArticles((prev) =>
        prev.map((a) => (a._id === data._id ? { ...a, ...data, updatedAt: new Date().toISOString() } as any : a))
      );
      console.log(data)
      setActiveView('articles');
      setCurrentArticle(null);
      return;
    }
    // crear → abrir modal para elegir carpeta de destino (se resolverá dinámicamente)
    setPendingArticle(data);
    setOpen(true);
  };

  const handleUpdateArticle = async  (data: {
    _id?: string; tema: string; contenidos: string[];
    ref_tabla_nivel0?: string | null;
    ref_tabla_nivel1?: string | null;
    ref_tabla_nivel2?: string | null;
    ref_tabla_nivel3?: string | null;
  }) => {
      
    console.log(data)
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

      const created = await res.json();
      // refresca listado principal
      setArticles((prev) => [...prev, created]);


      resetToNewArticle();
      setSuccessOpen(true);
    } catch (e) {
      console.error('Error creando artículo:', e);
      // aquí podrías mostrar un toast de error si lo deseas
    } finally {
      setSaving(false);
    }

  }

  // Helper para “limpiar todo” y preparar una nueva captura
  const resetToNewArticle = () => {
    setPendingArticle(null);
    setCurrentArticle(null);
    // Remontar editor para limpiar inputs
    setEditorKey((k) => k + 1);
    // Ir directo a la vista "add" para empezar desde cero
    setActiveView('add');
  };

  // Al elegir carpeta en el modal y GUARDAR
  const handleMoveTo = async (target: { fullId: string; level: number | null; rawId: string }) => {
    if (!pendingArticle || saving) return;

    setSaving(true);
    const apiUrl = import.meta.env.VITE_API_URL;

    const rawId = target.rawId; // id limpio de la carpeta
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

      const created = await res.json();
      // refresca listado principal
      setArticles((prev) => [...prev, created]);

      // ✅ cerrar modal mover, limpiar y mostrar éxito
      setOpen(false);
      resetToNewArticle();
      setSuccessOpen(true);
    } catch (e) {
      console.error('Error creando artículo:', e);
      // aquí podrías mostrar un toast de error si lo deseas
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

  //TODO Hacer funcionalidad de eliminar
  const handleDeleteArticle = (id: string) => {
        console.log("id")
        console.log(id)

    if (window.confirm('¿Eliminar este artículo?')) {
      setArticles((prev) => prev.filter((a) => a._id !== id));
    }
  };

  const handleAddArticle = () => {
    resetToNewArticle(); // garantiza editor limpio
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
            key={editorKey}                 // fuerza remonte al limpiar
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
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        activeView={activeView === 'add' || activeView === 'edit' ? 'add' : 'articles'}
        onViewChange={(view) => {
          if (view === 'add') handleAddArticle();
          else setActiveView('articles');
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
        title="¡Artículo creado exitosamente!"
        message="Tu artículo quedó guardado. Puedes continuar creando otro o volver al listado."
      />
    </div>
  );
};

export default Dashboard; 