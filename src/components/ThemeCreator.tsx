import React, { useEffect, useState } from 'react';
import { PlusCircle, X } from 'lucide-react';
import { Article } from '../types';

type Option = { value: string; label: string };

interface ThemeCreatorProps {
  article?: Article;
  onSave: (article: Partial<Article>) => void;
  onCancel: () => void;
}

const ThemeCreator: React.FC<ThemeCreatorProps> = ({ article, onSave, onCancel }) => {
  const [title, setTitle] = useState<string>(article?.tema ?? '');

  
  // 🔽 Estados para los 4 dropdowns
  const [dd1, setDd1] = useState<string>('');
  const [dd2, setDd2] = useState<string>('');
  const [dd3, setDd3] = useState<string>('');
  const [dd4, setDd4] = useState<string>('');

  const [dd1Options, setDd1Options] = useState<Option[]>([]); // opciones cargadas
  const [dd2Options, setDd2Options] = useState<Option[]>([]); // opciones cargadas
  const [dd3Options, setDd3Options] = useState<Option[]>([]); // opciones cargadas
  const [dd4ptions, setDd4ptions] = useState<Option[]>([]); // opciones cargadas
  const apiUrl = import.meta.env.VITE_API_URL;

  // Helpers
  const ensureGhostOption = (options: Option[], value: string | undefined | null) => {
    if (!value) return options;
    if (options.some(o => o.value === value)) return options;
    return [{ value, label: '(actual — no listado)' }, ...options];
  };

  const mapToOptions = (arr: any[]): Option[] =>
    (arr ?? []).map((it: any) => ({ value: String(it._id), label: String(it.nombre ?? 'Sin nombre') }));

  // Carga inicial de Nivel 0 (raíz) o todos si ya tienes el endpoint
  // Sincroniza cuando cambie el artículo
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
     const getDropdownsInfo = async() => {
          const res = await fetch(`${apiUrl}/nivelesScraping/niveles/temas`);
                  const json = await res.json(); 
                  console.log(json)
                  const opts0 = json[0].map(it => ({ value: it._id, label: it.nombre }));
                  const opts1 = json[1].map(it => ({ value: it._id, label: it.nombre }));
                  const opts2 = json[2].map(it => ({ value: it._id, label: it.nombre }));
                  const opts3 = json[3].map(it => ({ value: it._id, label: it.nombre }));
                  setDd1Options(opts0)
                  setDd2Options(opts1)
                  setDd3Options(opts2)
                  setDd4ptions(opts3)
     } 
    getDropdownsInfo()
    setTitle(article?.tema ?? '');
    
  }, [article]); 

  // Guardar solo con título + refs de niveles
  const handleSave = () => {
    const tema = title.trim();
    if (!tema) return;

    onSave({
      _id: article?._id,
      tema,
      // no hay contenido en este formulario
      contenidos: article?.contenidos?.length ? article.contenidos : [''],
      // refs según selección
      ref_tabla_nivel0: dd1 || null,
      ref_tabla_nivel1: dd2 || null,
      ref_tabla_nivel2: dd3 || null,
      ref_tabla_nivel3: dd4 || null,
      // si tu modelo usa estos:
      subtemas: article?.subtemas,
      sin_categoria: article?.sin_categoria ?? false,
      fecha_creacion: article?.fecha_creacion ?? null,
      fecha_modificacion: article?.fecha_modificacion ?? null,
    });
  };

  const isDisabled = !title.trim();

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-800">Nuevo tema</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isDisabled}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            CREAR
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
        </div>
      </div>

      {/* Dropdowns (Niveles) */}
      {/* 🔽 Cuatro dropdowns */} 
      <div className="p-6 border-b">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dropdown 1 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nivel 0</label>
            <select
                  value={dd1}
                  onChange={(e) => {
                    setDd1(e.target.value)
                    console.log(e.target.value)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="">{'Seleccione…'}</option> 
                  {dd1Options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
          </div>

          {/* Dropdown 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nivel 1</label>
            <select
              value={dd2}
              onChange={(e) => setDd2(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            >
              <option value="">{'Seleccione…'}</option> 
                  {dd2Options.map(opt => ( 
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
            </select> 
          </div>

          {/* Dropdown 3 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nivel 2</label>
            <select
              value={dd3}
              onChange={(e) => setDd3(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            >
              <option value="">{'Seleccione…'}</option> 
                  {dd3Options.map(opt => ( 
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
            </select>
          </div>

          {/* Dropdown 4 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nivel 3</label>
            <select
              value={dd4}
              onChange={(e) => setDd4(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            >
              <option value="">{'Seleccione…'}</option> 
                  {dd3Options.map(opt => ( 
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
            </select>
          </div>
        </div>
      </div> 

      {/* Title */}
      <div className="p-6 border-b">
        <label className="block text-sm font-medium text-gray-700 mb-2">Título</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ingrese el título del tema"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      




    </div>
  );
};

export default ThemeCreator; 