import React, { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import ArticleList from './ArticleList';
import ArticleEditor from './ArticleEditor';
import ArticleView from './ArticleView';
import { Article, User } from '../types';
 
import { DriveNode, ModalMoveDialog } from './ModalArchives'; // ojo: ruta correcta

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeView, setActiveView] = useState<'articles' | 'add' | 'edit' | 'view'>('articles');
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);

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

  // Carga inicial (ajusta a tu API)
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
    fetchData();
  }, []);

  // Loader de carpetas para el modal (cámbialo por tu API)
  const loadChildren = useCallback(async (parentId: string | null): Promise<DriveNode[]> => {
    const fakeTree: Record<string, DriveNode[]> = {
      root: [
        { id: 'f1', name: 'Download', type: 'folder' },
        { id: 'f2', name: 'Terraria', type: 'folder', starred: true },
        { id: 'f3', name: 'POO', type: 'folder' },
      ],
      f1: [{ id: 'm1', name: 'song.mp3', type: 'file' }],
      f2: [{ id: 'x1', name: 'Saves', type: 'folder' }, { id: 'x2', name: 'Screenshots', type: 'folder' }],
      f3: [],
      x1: [],
      x2: [],
    };
    await new Promise((r) => setTimeout(r, 150));
    return fakeTree[parentId ?? 'root'] ?? [];
  }, []);

  // Guardar (crear/editar)
  const handleSaveArticle = async (data: {
    _id?: string; tema: string; contenidos: string[];
    ref_tabla_nivel0?: string | null;
    ref_tabla_nivel1?: string | null;
    ref_tabla_nivel2?: string | null;
    ref_tabla_nivel3?: string | null;
  }) => {
    if (data._id) {
      // actualizar existente (ajusta a tu API si corresponde)
      setArticles((prev) =>
        prev.map((a) => (a._id === data._id ? { ...a, ...data, updatedAt: new Date().toISOString() } as any : a))
      );
      setActiveView('articles');
      setCurrentArticle(null);
      return;
    }

    // Crear: primero elegimos carpeta destino en el modal
    setPendingArticle(data);
    setOpen(true);
  };

  // Cuando el usuario elige carpeta
  const handleMoveTo = async (folderId: string) => {
    setOpen(false);
    if (!pendingArticle) return;

    const apiUrl = import.meta.env.VITE_API_URL;

    const newArticle: Article = {
      tema: pendingArticle.tema,
      contenidos: pendingArticle.contenidos,
      ref_tabla_nivel0: pendingArticle.ref_tabla_nivel0 ?? null,
      ref_tabla_nivel1: pendingArticle.ref_tabla_nivel1 ?? null,
      ref_tabla_nivel2: pendingArticle.ref_tabla_nivel2 ?? null,
      ref_tabla_nivel3: folderId, // ← usamos la carpeta elegida
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

      {/* Modal “Mover a…” montado siempre, controlado por `open` */}
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