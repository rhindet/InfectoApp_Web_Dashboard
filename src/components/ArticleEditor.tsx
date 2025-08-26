import React, { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Save, X } from 'lucide-react';
import { Article } from '../types';
import { Table } from 'lucide-react'; // 👈 icono de tabla

interface ArticleEditorProps {
  article?: Article; // usa tu interfaz completa
  onSave: (article: Partial<Article>) => void; // devuelve tema + contenidos[]
  onCancel: () => void;
}
type Option = { value: string; label: string };


const ArticleEditor: React.FC<ArticleEditorProps> = ({ article, onSave, onCancel }) => {
  // Título desde article.tema
  const [title, setTitle] = useState<string>(article?.tema ?? '');
  // Un solo string que representa el primer contenido del array
  const [content, setContent] = useState<string>(article?.contenidos?.[0] ?? '');
  const contentRef = useRef<HTMLDivElement>(null);

  // 🔽 Estados para los 4 dropdowns
  const [dd1, setDd1] = useState<string>('');
  const [dd2, setDd2] = useState<string>('');
  const [dd3, setDd3] = useState<string>('');
  const [dd4, setDd4] = useState<string>('');

  const [dd1Options, setDd1Options] = useState<Option[]>([]); // opciones cargadas
  const [dd2Options, setDd2Options] = useState<Option[]>([]); // opciones cargadas
  const [dd3Options, setDd3Options] = useState<Option[]>([]); // opciones cargadas
  const [dd4ptions, setDd4ptions] = useState<Option[]>([]); // opciones cargadas


  

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
    const initial = article?.contenidos?.[0] ?? '';
    setContent(initial);
    if (contentRef.current) {
      contentRef.current.innerHTML = initial;
    }
  }, [article]);

  const formatText = (command: string, value?: string) => {
  if (command === 'insertHTML' && value) {
    document.execCommand('insertHTML', false, value);
  } else { 
    document.execCommand(command, false, value);
  }
  contentRef.current?.focus();
};

  const handleContentChange = () => {
    if (contentRef.current) {
      setContent(contentRef.current.innerHTML);
    }
  };

  const insertTableWithExec = () => {
  const rows = Math.max(1, Number(prompt('¿Cuántas filas?', '2') || 2));
  const cols = Math.max(1, Number(prompt('¿Cuántas columnas?', '2') || 2));
  const withHeader = confirm('¿Incluir fila de encabezado?');

  const header = withHeader
    ? `<tr>${Array.from({ length: cols })
        .map((_, i) => `<th style="padding:6px;border:1px solid #ccc;background:#efefef;">Columna ${i + 1}</th>`)
        .join('')}</tr>`
    : '';

  const body = Array.from({ length: rows })
    .map(
      () =>
        `<tr>${Array.from({ length: cols })
          .map(() => `<td style="padding:6px;border:1px solid #ccc;">&nbsp;</td>`)
          .join('')}</tr>`
    )
    .join('');

  const html = `
    <table style="width:100%;border-collapse:collapse;margin:8px 0;">
      ${header}${body}
    </table><br/>
  `;

  document.execCommand('insertHTML', false, html);
  contentRef.current?.focus();
};

  //Guardar en bd
  const handleSave = () => {
    const tema = title.trim();
    const html = (contentRef.current?.innerHTML ?? '').trim();
    if (!tema || !html) return;

    const body = {
      _id: article?._id,                 // si existe, lo mandamos
      tema,                              // título
      contenidos: [html],                // arreglo con un solo elemento
      subtemas: article?.subtemas,       // preserva si existen
      sin_categoria: article?.sin_categoria ?? false,
      ref_tabla_nivel0: article?.ref_tabla_nivel0 ?? null,
      ref_tabla_nivel1: article?.ref_tabla_nivel1 ?? null,
      ref_tabla_nivel2: article?.ref_tabla_nivel2 ?? null,
      ref_tabla_nivel3: article?.ref_tabla_nivel3 ?? null,
      fecha_creacion: article?.fecha_creacion ?? null,
      fecha_modificacion: article?.fecha_modificacion ?? null,
      // Si luego quieres usar los dropdowns, aquí están listos:
      // filtros: { dd1, dd2, dd3, dd4 },
    }

    console.log(body)
    console.log(dd4) 
    
 
    onSave({
      _id: article?._id,                 // si existe, lo mandamos
      tema,                              // título
      contenidos: [html],                // arreglo con un solo elemento
      subtemas: article?.subtemas,       // preserva si existen
      sin_categoria: article?.sin_categoria ?? false,
      ref_tabla_nivel0: dd1?? null,
      ref_tabla_nivel1: dd2?? null,
      ref_tabla_nivel2: dd3 ?? null,
      ref_tabla_nivel3: dd4  ?? null, 
      fecha_creacion: article?.fecha_creacion ?? null,
      fecha_modificacion: article?.fecha_modificacion ?? null,
      // Si luego quieres usar los dropdowns, aquí están listos:
      // filtros: { dd1, dd2, dd3, dd4 },
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-800">
          {article?._id ? 'Editar Artículo' : 'Nuevo Artículo'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {article?._id ? 'ACTUALIZAR' : 'CREAR'}
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

      {/* Title Input */}
      <div className="p-6 border-b">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Título
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ingrese el título del artículo"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

     

      {/* Content Editor */}
      <div className="p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Contenido
        </label>
        
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
          
          <button
            type="button"
            onClick={() => formatText('bold')}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Negrita"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => formatText('italic')}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Cursiva"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => formatText('underline')}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Subrayado"
          >
            <Underline className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          <button
            type="button"
            onClick={() => formatText('insertUnorderedList')}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Lista con viñetas"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => formatText('insertOrderedList')}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Lista numerada"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
                type="button"
                onClick={insertTableWithExec}
                className="p-2 hover:bg-gray-200 rounded transition-colors"
                title="Insertar tabla"
              >
                <Table className="w-4 h-4" />
              </button>
        </div>

        {/* Editor */}
        <div
          ref={contentRef}
          contentEditable
          onInput={handleContentChange}
          className="relative min-h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          style={{ minHeight: '200px' }}
        />
        
        {/* Placeholder visual para contentEditable */}
        {!content && (
          <div className="pointer-events-none -mt-12 ml-4 text-gray-400">
            Ingrese el contenido del artículo aquí...
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticleEditor;