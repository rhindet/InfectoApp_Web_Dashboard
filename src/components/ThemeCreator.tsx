import React from 'react';
import { PlusCircle, X } from 'lucide-react';
import { Article } from '../types';

interface ThemeCreatorProps {
  article?: Article;
  onSave: (article: Partial<Article>) => void;
  onCancel: () => void;
}

const ThemeCreator: React.FC<ThemeCreatorProps> = ({ article, onSave, onCancel }) => {
  const handleSave = () => {
    // Tema genérico; puedes cambiar el string si quieres
    const tema = article?.tema ?? 'Nuevo tema';

    onSave({
      _id: article?._id,
      tema,
      contenidos: article?.contenidos?.length ? article.contenidos : [''],
      subtemas: article?.subtemas,
      sin_categoria: article?.sin_categoria ?? false,
      fecha_creacion: article?.fecha_creacion ?? null,
      fecha_modificacion: article?.fecha_modificacion ?? null,
      // NO mandamos refs de niveles aquí; los manejarás con el modal de carpetas
      ref_tabla_nivel0: null,
      ref_tabla_nivel1: null,
      ref_tabla_nivel2: null,
      ref_tabla_nivel3: null,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-800">Nuevo tema</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            CREAR
          </button>
          
        </div>
      </div>

    
    </div>
  );
};

export default ThemeCreator;