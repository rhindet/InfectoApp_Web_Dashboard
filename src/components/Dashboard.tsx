import React, { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
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

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeView, setActiveView] = useState<'articles' | 'add' | 'edit' | 'view'>('articles');
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);

  // Opciones por nivel (se llenan desde /nivelesScraping/niveles/temas)
  const [dd1Options, setDd1Options] = useState<Option[]>([]);
  const [dd2Options, setDd2Options] = useState<Option[]>([]);
  const [dd3Options, setDd3Options] = useState<Option[]>([]);
  const [dd4ptions, setDd4ptions] = useState<Option[]>([]);

  // Modal "Mover a…"
  const [open, setOpen] = useState(false);
  const [pendingArticle, setPendingArticle] = useState<null | {
    _id?: string;
    tema: string;
    contenidos: string[];
    ref_tabla_nivel0?: string | null;
    ref_tabla_nivel1?: string | null;
    ref_tabla_nivel2?: string | null;
    ref_tabla_nivel3?: string | null;
  }>(null);

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

        // Convierte la respuesta a arrays de Option
        const opts0: Option[] = (json?.[0] ?? []).map((it: any) => ({ value: it._id, label: it.nombre }));
        const opts1: Option[] = (json?.[1] ?? []).map((it: any) => ({ value: it._id, label: it.nombre }));
        const opts2: Option[] = (json?.[2] ?? []).map((it: any) => ({ value: it._id, label: it.nombre }));
        const opts3: Option[] = (json?.[3] ?? []).map((it: any) => ({ value: it._id, label: it.nombre }));

        setDd1Options(opts0);
        setDd2Options(opts1);
        setDd3Options(opts2);
        setDd4ptions(opts3);
      } catch (e) {
        console.error('Error cargando temas:', e);
      }
    };

    getTemas();
    fetchData();
  }, []);

  // Utilidad: Option -> DriveNode (carpeta)
  const optionToFolder = (levelPrefix: string) => (opt: Option, index?: number): DriveNode => ({
    id: `${levelPrefix}:${opt.value}`,
    name: opt.label,
    type: "folder",
    // Ejemplo: marca algunas como favoritas si quieres (pestaña Starred)
    starred: index !== undefined ? index % 3 === 0 : false,
  });

  // Loader de carpetas usando dd1Options..dd4ptions
  const loadChildren = useCallback(async (parentId: string | null): Promise<DriveNode[]> => {
    // Si aún no hay datos, devuelve vacío (evita errores)
    const hasAny =
      dd1Options.length || dd2Options.length || dd3Options.length || dd4ptions.length;
    if (!hasAny) return [];

    // Raíz: muestra todos los de nivel 0
    if (parentId === null) {
      return dd1Options.map(optionToFolder("L0"));
    }

    // L0 -> L1
    if (parentId.startsWith("L0:")) {
      return dd2Options.map(optionToFolder("L1"));
    }

    // L1 -> L2
    if (parentId.startsWith("L1:")) {
      return dd3Options.map(optionToFolder("L2"));
    }

    // L2 -> L3
    if (parentId.startsWith("L2:")) {
      return dd4ptions.map(optionToFolder("L3"));
    }

    // L3 no tiene hijos
    if (parentId.startsWith("L3:")) {
      return [];
    }

    return [];
  }, [dd1Options, dd2Options, dd3Options, dd4ptions]);

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
      setActiveView('articles');
      setCurrentArticle(null);
      return;
    }
    // crear → abrir modal para elegir carpeta de destino
    setPendingArticle(data);
    setOpen(true);
  };

  // Al elegir carpeta en el modal
  const handleMoveTo = async (folderId: string) => {
    setOpen(false);
    if (!pendingArticle) return;

    const apiUrl = import.meta.env.VITE_API_URL;

    // Si quieres guardar solo el ObjectId (sin el prefijo "Lx:")
    const rawId = folderId.includes(":") ? folderId.split(":")[1] : folderId;

    const newArticle: Article = {
      tema: pendingArticle.tema,
      contenidos: pendingArticle.contenidos,
      ref_tabla_nivel0: pendingArticle.ref_tabla_nivel0 ?? null,
      ref_tabla_nivel1: pendingArticle.ref_tabla_nivel1 ?? null,
      ref_tabla_nivel2: pendingArticle.ref_tabla_nivel2 ?? null,
      ref_tabla_nivel3: rawId, // carpeta elegida (id "limpio")
    } as any;

    try {
      const res = await fetch(`${apiUrl}/nivelesScraping/crearArticulo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newArticle),
      });
      const created = await res.json();
      setArticles((prev) => [...prev, created]);
    } catch (e) {
      console.error('Error creando artículo:', e);
    } finally {
      setPendingArticle(null);
      setActiveView('articles');
      setCurrentArticle(null);
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

  const handleDeleteArticle = (id: string) => {
    if (window.confirm('¿Eliminar este artículo?')) {
      setArticles((prev) => prev.filter((a) => a._id !== id));
    }
  };

  const handleAddArticle = () => {
    setCurrentArticle(null);
    setActiveView('add');
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
            article={currentArticle || undefined}
            onSave={handleSaveArticle}
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
          setOpen(false);
          setPendingArticle(null);
        }}
        onMove={handleMoveTo}
        loadChildren={loadChildren}
        rootId={null}
      />
    </div>
  );
};

export default Dashboard; 