import React from 'react';
import { Eye, Edit, Trash2, Plus } from 'lucide-react';
import { Article } from '../types';

interface ArticleListProps {
  articles: Article[];
  onEdit: (article: Article) => void;
  onDelete: (id: string) => void;
  onView: (article: Article) => void;
  onAdd: () => void;
}

const ArticleList: React.FC<ArticleListProps> = ({
  articles,
  onEdit,
  onDelete,
  onView,
  onAdd
}) => {

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  // 1) Conteo de IDs
  const idCounts = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of articles) m[a._id] = (m[a._id] || 0) + 1;
    return m;
  }, [articles]);


  const sortedArticles = React.useMemo(() => {
    return [...articles].sort((a, b) =>
      (a.tema || "").localeCompare(b.tema || "", "es", { sensitivity: "base" })
    );
  }, [articles]);


  // 2) Log de duplicados (opcional)
  React.useEffect(() => {
    const dups = Object.entries(idCounts)
      .filter(([, c]) => c > 1)
      .map(([id]) => id);
    if (dups.length) {
      console.warn('IDs duplicados:', dups);
    }
  }, [idCounts]);

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-800">Gestión de Temas</h2>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Artículo
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-6 border-b">
        <input
          type="text"
          placeholder="Buscar..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Título
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha creación
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha actualización
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {articles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <div className="text-gray-400 text-2xl">📄</div>
                    </div>
                    <p className="text-lg font-medium mb-2">No hay artículos</p>
                    <p className="text-sm text-gray-400 mb-4">Comienza creando tu primer artículo</p>
                    <button
                      onClick={onAdd}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Crear Artículo
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              sortedArticles.map((article) => {
                const isDup = idCounts[article._id] > 1;
                return (
                  <tr key={article._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {article._id}
                      {isDup && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                          Duplicado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{article.tema}</div>
                      <div className="text-sm text-gray-500">
                        {"Contenidos"}

                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {"fecha de creacion"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {"fecha de modificacion"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onView(article)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEdit(article)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(article._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArticleList; 