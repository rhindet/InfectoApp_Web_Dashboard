import React from "react";
import { Eye, Edit, Trash2, Plus } from "lucide-react";
import { Article } from "../types";

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
  onAdd,
}) => {
  // ✅ Search state
  const [search, setSearch] = React.useState("");

  // 1) Conteo de IDs
  const idCounts = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of articles) m[a._id] = (m[a._id] || 0) + 1;
    return m;
  }, [articles]);

  // Orden por tema
  const sortedArticles = React.useMemo(() => {
    return [...articles].sort((a, b) =>
      (a.tema || "").localeCompare(b.tema || "", "es", { sensitivity: "base" })
    );
  }, [articles]);

  // ✅ Función normalizadora para búsqueda (acentos/case-insensitive)
  const normalize = (s: string) =>
    (s ?? "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  // ✅ Filtrado por búsqueda
  const filteredArticles = React.useMemo(() => {
    const q = normalize(search);
    if (!q) return sortedArticles;

    return sortedArticles.filter((a) => {
      const haystack = [a.tema, a._id]
        .filter(Boolean)
        .map((x) => normalize(String(x)))
        .join(" | ");

      return haystack.includes(q);
    });
  }, [search, sortedArticles]);

  // Log de duplicados (opcional)
  React.useEffect(() => {
    const dups = Object.entries(idCounts)
      .filter(([, c]) => c > 1)
      .map(([id]) => id);
    if (dups.length) console.warn("IDs duplicados:", dups);
  }, [idCounts]);

  const fechaMX = (fechaMongo: any) =>
    fechaMongo
      ? new Date(fechaMongo).toLocaleString("es-MX", {
          timeZone: "America/Mexico_City",
        })
      : "—";

  // Para mobile: mostrar solo final del id
  const shortId = (id?: string) => {
    if (!id) return "";
    if (id.length <= 10) return id;
    return `…${id.slice(-8)}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-800">
            Gestión de Temas
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Mostrando {filteredArticles.length} de {articles.length}
          </p>
        </div>

        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo Artículo
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-6 border-b">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por tema o ID..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Table Wrapper: el scroll horizontal SOLO vive aquí */}
      <div className="w-full overflow-x-auto">
        {/* min-w: asegura que la tabla no se aplaste; en móvil habrá scroll interno si hace falta */}
        <table className="w-full min-w-[860px] table-fixed">
          <thead className="bg-gray-50">
            <tr>
              {/* ID */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[240px]">
                ID
              </th>

              {/* Título */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[380px]">
                Título
              </th>

              {/* Fechas: ocultas en pantallas chicas */}
              <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[210px]">
                Fecha creación
              </th>
              <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[230px]">
                Fecha actualización
              </th>

              {/* Acciones */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[160px]">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {filteredArticles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <div className="text-gray-400 text-2xl">🔎</div>
                    </div>

                    {search.trim() ? (
                      <>
                        <p className="text-lg font-medium mb-2">Sin resultados</p>
                        <p className="text-sm text-gray-400">
                          No hay coincidencias para “{search}”
                        </p>
                        <button
                          onClick={() => setSearch("")}
                          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Limpiar búsqueda
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-medium mb-2">No hay artículos</p>
                        <p className="text-sm text-gray-400 mb-4">
                          Comienza creando tu primer artículo
                        </p>
                        <button
                          onClick={onAdd}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Crear Artículo
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredArticles.map((article) => {
                const isDup = idCounts[article._id] > 1;

                return (
                  <tr key={article._id} className="hover:bg-gray-50">
                    {/* ID */}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Mobile: corto | Desktop: completo */}
                        <span className="font-mono whitespace-nowrap md:hidden">
                          {shortId(article._id)}
                        </span>
                        <span className="font-mono whitespace-nowrap hidden md:inline">
                          {article._id}
                        </span>

                        {isDup && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800 whitespace-nowrap">
                            Duplicado
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Título */}
                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        {/* truncate para que no rompa la tabla */}
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {article.tema}
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          Contenidos
                        </div>
                      </div>
                    </td>

                    {/* Fecha creación (solo md+) */}
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {fechaMX((article as any).fecha_creacion)}
                    </td>

                    {/* Fecha actualización (solo md+) */}
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {fechaMX((article as any).fecha_modificacion)}
                    </td>

                    {/* Acciones */}
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-2 whitespace-nowrap">
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