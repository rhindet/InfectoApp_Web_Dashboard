import React from 'react';
import { ArrowLeft, Edit } from 'lucide-react';
import { Article } from '../types';

interface ArticleViewProps {
  article: Article;
  onBack: () => void;
  onEdit: (article: Article) => void;
}

const ArticleView: React.FC<ArticleViewProps> = ({ article, onBack, onEdit }) => {


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{article.tema}</h2>
            <p className="text-sm text-gray-500">
              Creado: {"Fecha de creacion"} | 
              Actualizado: {"Fecha modificacion"}
            </p>
          </div>
        </div>
        <button
          onClick={() => onEdit(article)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Editar
        </button>
      </div>

      {/* Content */}
      {/* Contenido html*/}
      <div className="p-6">
        <div 
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: article.contenidos }}
        />
        
      </div>
    </div>
  );
};

export default ArticleView;