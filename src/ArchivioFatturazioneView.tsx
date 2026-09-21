import React, { useState, useRef, useEffect } from 'react';
import { Upload, File, FileText, Image as ImageIcon, Trash2, ExternalLink, Search, FolderOpen, Lock } from 'lucide-react';
import { useAuth } from './AuthContext';
import { getArchive, saveToArchive, removeFromArchive, ArchivedDocument } from './storage';

export default function ArchivioFatturazioneView() {
  const { isWriter } = useAuth();
  const [documents, setDocuments] = useState<(ArchivedDocument & {fileUrl: string})[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Upload form state
  const [relatedId, setRelatedId] = useState('');
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Generate object URLs for the files so they can be viewed
    let urlsToRevoke: string[] = [];
    
    const loadDocs = async () => {
      const docs = await getArchive();
      
      const docsWithUrls = docs.map(d => {
        const url = URL.createObjectURL(d.file);
        urlsToRevoke.push(url);
        // We'll attach the URL to the doc object temporarily for rendering
        return { ...d, fileUrl: url };
      });
      
      setDocuments(docsWithUrls as any);
    };
    
    loadDocs();
    
    return () => {
      urlsToRevoke.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const chosenName = relatedId.trim() || file.name;
    
    const newDoc: ArchivedDocument = {
      id: Math.random().toString(36).substr(2, 9),
      fileName: file.name,
      fileType: file.type,
      file,
      relatedId: chosenName,
      description: description.trim(),
      uploadDate: new Date()
    };

    await saveToArchive(newDoc);
    
    // Create url for local display
    const docWithUrl = { ...newDoc, fileUrl: URL.createObjectURL(file) };
    setDocuments(prev => [docWithUrl as any, ...prev]);
    
    // Reset inputs
    setRelatedId('');
    setDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    await removeFromArchive(id);
    
    setDocuments(prev => {
      const docToDelete = prev.find(d => d.id === id) as any;
      if (docToDelete && docToDelete.fileUrl) {
        URL.revokeObjectURL(docToDelete.fileUrl);
      }
      return prev.filter(d => d.id !== id);
    });
  };

  const filteredDocs = documents.filter(doc => 
    doc.relatedId.toLowerCase().includes(searchTerm.toLowerCase()) || 
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFileIcon = (type: string, name: string) => {
    if (type.startsWith('image/')) return <ImageIcon size={20} className="text-blue-500" />;
    if (type === 'application/pdf') return <FileText size={20} className="text-red-500" />;
    if (name.endsWith('.xls') || name.endsWith('.xlsx') || type.includes('excel') || type.includes('spreadsheet')) {
      return <File size={20} className="text-green-600" />;
    }
    return <File size={20} className="text-gray-500" />;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-[#2d325a] mb-2">Archivio Documenti Fatturazione</h2>
        <p className="text-gray-500">
          Carica e archivia fatture, ricevute o documenti di lavorazione. I file sono salvati localmente per la sessione corrente.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col md:flex-row gap-6 items-start">
        {/* Upload Form */}
        {isWriter ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 w-full md:w-1/3 shrink-0">
            <h3 className="font-semibold text-lg text-gray-800 mb-4 flex items-center gap-2">
              <Upload size={18} className="text-[#3b4781]" />
              Nuovo Caricamento
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome file</label>
                <input 
                  type="text" 
                  value={relatedId}
                  onChange={e => setRelatedId(e.target.value)}
                  placeholder="Es. Fattura_Fornitore_01 (facoltativo)"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione (opzionale)</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Es. Fattura Q4 2025"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781]"
                />
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*,.pdf,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                className="hidden" 
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3b4781] text-white rounded-md text-sm font-medium hover:bg-[#2d325a] transition-colors shadow-sm"
              >
                <File size={16} />
                Seleziona e Carica File
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Formati supportati: PDF, XLS, JPG, PNG
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 w-full md:w-1/4 shrink-0">
            <h3 className="font-semibold text-base text-gray-800 mb-2 flex items-center gap-2">
              <Lock size={16} className="text-amber-600" />
              Modalità Consultazione
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Il tuo profilo ha accesso in sola lettura per la consultazione e il download dei documenti archiviati. Il caricamento e la cancellazione sono riservati agli utenti abilitati.
            </p>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full flex-1 flex flex-col h-full min-h-[400px]">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50 rounded-t-lg">
            <h3 className="font-semibold text-gray-800">Documenti in Archivio</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Cerca per nome file, descrizione..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] w-64"
              />
            </div>
          </div>
          
          <div className="overflow-auto flex-1 p-0">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-100 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Nome File</th>
                  <th className="px-4 py-3 font-semibold">Descrizione</th>
                  <th className="px-4 py-3 font-semibold">Data Caricamento</th>
                  <th className="px-4 py-3 font-semibold text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length > 0 ? (
                  filteredDocs.map((doc, idx) => (
                    <tr key={doc.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3 w-12 text-center">
                        {getFileIcon(doc.fileType, doc.fileName)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[240px]" title={doc.relatedId || doc.fileName}>
                        <span className="font-semibold text-gray-800">{doc.relatedId || doc.fileName}</span>
                        {doc.relatedId && doc.fileName && doc.relatedId !== doc.fileName && (
                          <span className="block text-xs text-gray-400 font-mono">{doc.fileName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[150px]" title={doc.description}>
                        {doc.description || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {doc.uploadDate.toLocaleString('it-IT')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a 
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Apri in una nuova scheda"
                          >
                            <ExternalLink size={18} />
                          </a>
                          {isWriter && (
                            <button 
                              onClick={() => handleDelete(doc.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Elimina"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <FolderOpen size={48} className="text-gray-300 mb-3" />
                        <p className="text-base font-medium text-gray-600">Nessun documento in archivio</p>
                        <p className="text-sm mt-1">Carica un file usando il pannello di sinistra.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
