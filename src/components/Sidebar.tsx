import React from 'react';
import { FileText, Plus } from 'lucide-react';

interface SidebarProps {
  activeView: 'articles' | 'add';
  onViewChange: (view: 'articles' | 'add') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  return (
    <div className="w-64 bg-blue-800 text-white min-h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-blue-700">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mr-3">
            <div className="text-blue-800 font-bold text-lg">IN</div>
          </div>
          <div>
            <h1 className="font-bold text-lg">INFECTOLOGÍA</h1>
            <p className="text-blue-300 text-sm">Gestión de Investigación</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6">
        <button
          onClick={() => onViewChange('articles')}
          className={`w-full flex items-center px-6 py-3 text-left hover:bg-blue-700 transition-colors ${
            activeView === 'articles' ? 'bg-blue-700 border-r-4 border-white' : ''
          }`}
        >
          <FileText className="w-5 h-5 mr-3" />
          Temas
        </button>
        
        <button
          onClick={() => onViewChange('add')}
          className={`w-full flex items-center px-6 py-3 text-left hover:bg-blue-700 transition-colors ${
            activeView === 'add' ? 'bg-blue-700 border-r-4 border-white' : ''
          }`}
        >
          <Plus className="w-5 h-5 mr-3" />
          Añadir
        </button>
      </nav>
    </div>
  );
};

export default Sidebar;