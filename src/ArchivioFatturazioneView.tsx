import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  File, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  ExternalLink, 
  Search, 
  FolderOpen, 
  Lock, 
  Cloud, 
  Download, 
  Loader2, 
  CheckCircle2 
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { 
  subscribeToArchive, 
  saveToArchive, 
  removeFromArchive, 
  downloadCloudDocument,
  getDocumentFileUrl,
  ArchivedDocument 
} from './storage';
import { toast } from 'react-hot-toast';

export default function ArchivioFatturazioneView() {
  const { isWriter } = useAuth();
  const [documents, setDocuments] = useState<ArchivedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Upload form state
  const [relatedId, setRelatedId] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletion confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Subscribe to real-time Cloud updates from Firestore
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToArchive(
      (docs) => {
        setDocuments(docs);
        setLoading(false);
      },
      (error) => {
        console.error('Errore archivio cloud:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const chosenName = relatedId.trim() || file.name;
    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const newDoc: ArchivedDocument = {
        id: Math.random().toString(36).substr(2, 9),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        file,
        relatedId: chosenName,
        description: description.trim(),
        uploadDate: new Date()
      };

      await saveToArchive(newDoc, file);
      
      toast.success(`File "${chosenName}" salvato nel Cloud!`);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);

      // Reset form inputs
      setRelatedId('');
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Errore caricamento cloud:', err);
      toast.error('Errore durante il salvataggio in cloud: ' + (err?.message || 'Riprova.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenOrDownload = async (docItem: ArchivedDocument) => {
    try {
      await downloadCloudDocument(docItem);
    } catch (err) {
      console.error('Errore apertura documento:', err);
      toast.error('Impossibile aprire il file dal cloud.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Sei sicuro di voler eliminare dal Cloud il file "${name}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      await removeFromArchive(id);
      toast.success('File eliminato dal Cloud.');
    } catch (err: any) {
      console.error('Errore eliminazione:', err);
      toast.error('Errore durante l\'eliminazione dal Cloud.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDocs = documents.filter(doc => 
    (doc.relatedId && doc.relatedId.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (doc.fileName && doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getFileIcon = (type: string, name: string) => {
    if (type.startsWith('image/')) return <ImageIcon size={20} className="text-blue-500" />;
    if (type === 'application/pdf') return <FileText size={20} className="text-red-500" />;
    if (name.endsWith('.xls') || name.endsWith('.xlsx') || type.includes('excel') || type.includes('spreadsheet')) {
      return <File size={20} className="text-emerald-600" />;
    }
    return <File size={20} className="text-gray-500" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top Banner */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[#2d325a]">Archivio Documenti Fatturazione</h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                <Cloud size={14} className="text-emerald-600" />
                Salvataggio in Cloud Attivo
              </span>
            </div>
            <p className="text-gray-500 mt-1">
              Carica e archivia fatture, ricevute o documenti di lavorazione. I file sono salvati nel Cloud e sincronizzati in tempo reale tra tutti i dispositivi.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-medium">
              {loading ? 'Caricamento archivio...' : `${documents.length} ${documents.length === 1 ? 'file presente nel Cloud' : 'file presenti nel Cloud'}`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col md:flex-row gap-6 items-start">
        {/* Upload Form */}
        {isWriter ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 w-full md:w-1/3 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                <Upload size={18} className="text-[#3b4781]" />
                Nuovo Caricamento in Cloud
              </h3>
              <Cloud size={18} className="text-emerald-600" />
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome file</label>
                <input 
                  type="text" 
                  value={relatedId}
                  onChange={e => setRelatedId(e.target.value)}
                  placeholder="Es. Fattura_Fornitore_01 (facoltativo)"
                  disabled={isUploading}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-400 mt-1">Se vuoto, verrà usato il nome originario del file.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione (opzionale)</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Es. Fattura Q4 2025"
                  disabled={isUploading}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] disabled:bg-gray-100"
                />
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*,.pdf,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                className="hidden" 
                disabled={isUploading}
              />
              
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3b4781] text-white rounded-md text-sm font-medium hover:bg-[#2d325a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-white" />
                    <span>Salvataggio in Cloud in corso...</span>
                  </>
                ) : (
                  <>
                    <Cloud size={16} />
                    <span>Seleziona e Salva in Cloud</span>
                  </>
                )}
              </button>

              {uploadSuccess && (
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 py-1.5 px-2 rounded-md transition-all">
                  <CheckCircle2 size={14} />
                  <span>File salvato nel Cloud con successo!</span>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center mt-2">
                Formati supportati: PDF, XLS, XLSX, JPG, PNG (salvataggio cloud permanente)
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 w-full md:w-1/4 shrink-0">
            <h3 className="font-semibold text-base text-gray-800 mb-2 flex items-center gap-2">
              <Lock size={16} className="text-amber-600" />
              Modalità Consultazione Cloud
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Il tuo profilo ha accesso in sola lettura per la consultazione e il download dei documenti salvati nel Cloud. Il caricamento e la cancellazione sono riservati agli utenti abilitati.
            </p>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full flex-1 flex flex-col h-full min-h-[400px]">
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50/50 rounded-t-lg">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">Documenti nel Cloud</h3>
              <span className="text-xs text-gray-400">({filteredDocs.length})</span>
            </div>

            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Cerca per nome file, descrizione..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] w-full sm:w-64"
              />
            </div>
          </div>
          
          <div className="overflow-auto flex-1 p-0">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-semibold w-12 text-center">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Nome File</th>
                  <th className="px-4 py-3 font-semibold">Descrizione</th>
                  <th className="px-4 py-3 font-semibold">Dimensione</th>
                  <th className="px-4 py-3 font-semibold">Data Caricamento</th>
                  <th className="px-4 py-3 font-semibold text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-[#3b4781]" size={28} />
                        <span className="text-sm">Caricamento documenti dal Cloud in corso...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredDocs.length > 0 ? (
                  filteredDocs.map((doc, idx) => (
                    <tr 
                      key={doc.id} 
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-4 py-3 w-12 text-center">
                        {getFileIcon(doc.fileType, doc.fileName)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[240px]" title={doc.relatedId || doc.fileName}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{doc.relatedId || doc.fileName}</span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded font-mono border border-sky-100" title="Salvato su Google Cloud">
                            <Cloud size={10} />
                            Cloud
                          </span>
                        </div>
                        {doc.relatedId && doc.fileName && doc.relatedId !== doc.fileName && (
                          <span className="block text-xs text-gray-400 font-mono mt-0.5">{doc.fileName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[150px]" title={doc.description}>
                        {doc.description || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                        {formatFileSize(doc.fileSize) || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {doc.uploadDate ? doc.uploadDate.toLocaleString('it-IT') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Scarica o Apri dal Cloud */}
                          <button
                            type="button"
                            onClick={() => handleOpenOrDownload(doc)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1 text-xs"
                            title="Visualizza / Scarica dal Cloud"
                          >
                            <Download size={16} />
                            <span className="hidden sm:inline">Scarica</span>
                          </button>

                          {/* Se c'è un url diretto, consenti anche apertura in nuova scheda */}
                          {doc.fileUrl && (
                            <a 
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-md transition-colors"
                              title="Apri collegamento diretto"
                            >
                              <ExternalLink size={16} />
                            </a>
                          )}

                          {isWriter && (
                            <button 
                              type="button"
                              onClick={() => handleDelete(doc.id, doc.relatedId || doc.fileName)}
                              disabled={deletingId === doc.id}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                              title="Elimina dal Cloud"
                            >
                              {deletingId === doc.id ? (
                                <Loader2 size={16} className="animate-spin text-red-500" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <FolderOpen size={48} className="text-gray-300 mb-3" />
                        <p className="text-base font-medium text-gray-600">Nessun documento salvato nel Cloud</p>
                        <p className="text-sm mt-1 text-gray-400">
                          {searchTerm ? 'Nessun risultato corrispondente alla ricerca.' : 'Carica un file usando il pannello a sinistra per salvarlo in Cloud.'}
                        </p>
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
