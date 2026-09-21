import React, { useState, useRef, useEffect } from 'react';
import { Upload, File, FileText, Image as ImageIcon, X, FolderOpen, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { useAuth } from './AuthContext';
import { 
  getTabAttachment, 
  saveTabAttachment, 
  removeTabAttachment, 
  saveToArchive,
  getFatturazioneTabs,
  saveFatturazioneTabs,
  renameTabAttachment,
  DEFAULT_TABS
} from './storage';

export default function FatturazioneView() {
  const { isWriter } = useAuth();
  const [tabs, setTabs] = useState<string[]>(DEFAULT_TABS);
  const [activeTab, setActiveTab] = useState('Acqua');
  const [attachment, setAttachment] = useState<{ name: string, type: string, url: string, file: File } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState('');
  
  // States for Tab Management
  const [isCreatingTab, setIsCreatingTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [editTabName, setEditTabName] = useState('');
  const [deletingTab, setDeletingTab] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load tabs from storage on mount
  useEffect(() => {
    getFatturazioneTabs().then(storedTabs => {
      if (storedTabs && storedTabs.length > 0) {
        setTabs(storedTabs);
        if (!storedTabs.includes(activeTab)) {
          setActiveTab(storedTabs[0]);
        }
      }
    });
  }, []);

  useEffect(() => {
    let currentUrl = '';
    const loadAttachment = async () => {
      try {
        const stored = await getTabAttachment(activeTab);
        if (stored) {
          currentUrl = URL.createObjectURL(stored.file);
          setAttachment({ ...stored, url: currentUrl });
        } else {
          setAttachment(null);
        }
      } catch (e) {
        console.error("Error loading attachment", e);
      }
    };
    loadAttachment();
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [activeTab]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setPendingFile(file);
    setCustomFileName(file.name);
    e.target.value = '';
  };

  const confirmFileUpload = async () => {
    if (!pendingFile) return;
    
    if (attachment) {
      const archiveDoc = {
        id: Math.random().toString(36).substr(2, 9),
        fileName: attachment.name,
        fileType: attachment.type,
        file: attachment.file,
        relatedId: 'Sezione: ' + activeTab,
        description: 'Documento sostituito in Fatturazione - ' + activeTab,
        uploadDate: new Date()
      };
      await saveToArchive(archiveDoc);
      URL.revokeObjectURL(attachment.url);
    }
    
    const finalName = customFileName.trim() || pendingFile.name;
    const newAtt = { name: finalName, type: pendingFile.type, file: pendingFile };
    await saveTabAttachment(activeTab, newAtt);
    
    const url = URL.createObjectURL(pendingFile);
    setAttachment({ ...newAtt, url });
    
    setPendingFile(null);
    setCustomFileName('');
  };

  const cancelFileUpload = () => {
    setPendingFile(null);
    setCustomFileName('');
  };

  const clearAttachment = async () => {
    if (attachment) {
      URL.revokeObjectURL(attachment.url);
      setAttachment(null);
      await removeTabAttachment(activeTab);
    }
  };

  // Tab Management Actions
  const handleCreateTab = async () => {
    const trimmed = newTabName.trim();
    if (!trimmed) return;
    if (tabs.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      alert('Esiste già una scheda con questo nome');
      return;
    }
    const updatedTabs = [...tabs, trimmed];
    setTabs(updatedTabs);
    await saveFatturazioneTabs(updatedTabs);
    setActiveTab(trimmed);
    setIsCreatingTab(false);
    setNewTabName('');
  };

  const handleStartEditTab = (tab: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTab(tab);
    setEditTabName(tab);
  };

  const handleRenameTab = async () => {
    if (!editingTab) return;
    const trimmed = editTabName.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() !== editingTab.toLowerCase() && tabs.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      alert('Esiste già una scheda con questo nome');
      return;
    }
    const updatedTabs = tabs.map(t => t === editingTab ? trimmed : t);
    setTabs(updatedTabs);
    await saveFatturazioneTabs(updatedTabs);
    await renameTabAttachment(editingTab, trimmed);
    if (activeTab === editingTab) {
      setActiveTab(trimmed);
    }
    setEditingTab(null);
    setEditTabName('');
  };

  const handleStartDeleteTab = (tab: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingTab(tab);
  };

  const handleDeleteTab = async () => {
    if (!deletingTab) return;
    if (tabs.length <= 1) {
      alert('Deve rimanere almeno una scheda attiva.');
      setDeletingTab(null);
      return;
    }
    const updatedTabs = tabs.filter(t => t !== deletingTab);
    setTabs(updatedTabs);
    await saveFatturazioneTabs(updatedTabs);
    await removeTabAttachment(deletingTab);
    if (activeTab === deletingTab) {
      setActiveTab(updatedTabs[0]);
    }
    setDeletingTab(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-[#2d325a]">Fatturazione e Ripartizione Spese</h2>
          <p className="text-sm text-gray-500">Gestisci i documenti per ogni sezione</p>
        </div>
        
        {isWriter && (
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept="image/*,.pdf,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-[#3b4781] text-white rounded-md text-sm font-medium hover:bg-[#2d325a] transition-colors"
            >
              <Upload size={18} />
              <span>Allega Documento</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs Bar with Create, Edit, Delete */}
      <div className="flex items-center overflow-x-auto bg-white border-b border-gray-200 shrink-0 px-2">
        <div className="flex items-center">
          {tabs.map(tab => {
            const isActive = activeTab === tab;
            return (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`group relative flex items-center border-b-2 transition-all cursor-pointer select-none ${
                  isActive 
                    ? 'border-[#3b4781] text-[#3b4781] bg-blue-50/50 font-semibold' 
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50/60'
                }`}
              >
                <span className="px-3.5 py-3 text-sm whitespace-nowrap">
                  {tab}
                </span>

                {/* Modifica & Elimina bottoni */}
                {isWriter && (
                  <div className={`flex items-center pr-2 gap-0.5 transition-opacity ${
                    isActive ? 'opacity-90' : 'opacity-0 group-hover:opacity-80'
                  }`}>
                    <button
                      type="button"
                      onClick={(e) => handleStartEditTab(tab, e)}
                      title={`Rinomina "${tab}"`}
                      className="p-1 text-gray-400 hover:text-[#3b4781] hover:bg-gray-200/70 rounded transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleStartDeleteTab(tab, e)}
                      title={`Elimina "${tab}"`}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pulsante Crea Nuova Scheda */}
        {isWriter && (
          <button
            type="button"
            onClick={() => {
              setIsCreatingTab(true);
              setNewTabName('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 ml-2 my-2 text-xs font-semibold text-[#3b4781] hover:text-white bg-blue-50 hover:bg-[#3b4781] border border-blue-200 hover:border-[#3b4781] rounded-md transition-all shrink-0 cursor-pointer shadow-2xs"
            title="Aggiungi una nuova scheda"
          >
            <Plus size={14} />
            <span>Nuova scheda</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-6">
        {attachment ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col h-full overflow-hidden">
            <div className="bg-blue-50/50 p-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h4 className="font-semibold text-[#2d325a] flex items-center gap-2 text-sm">
                {attachment.type.startsWith('image/') ? <ImageIcon size={18} className="text-blue-500" /> : attachment.type === 'application/pdf' ? <FileText size={18} className="text-red-500" /> : <File size={18} className="text-green-600" />}
                Documento di riferimento ({activeTab}): <span className="font-normal text-gray-600">{attachment.name}</span>
              </h4>
              {isWriter && (
                <div className="flex items-center gap-2">
                  <button onClick={clearAttachment} className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-full hover:bg-white" title="Rimuovi">
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
            <div className="p-4 flex-1 overflow-auto flex justify-center items-center bg-gray-50/50">
              {attachment.type.startsWith('image/') && (
                <img src={attachment.url} alt={attachment.name} className="max-w-full max-h-full object-contain rounded shadow-sm border border-gray-200" />
              )}
              {attachment.type === 'application/pdf' && (
                <div className="p-8 text-gray-500 flex flex-col items-center bg-white rounded-lg shadow-sm border border-gray-200">
                  <FileText size={64} className="mb-4 text-red-500 opacity-80" />
                  <span className="font-medium text-gray-700 mb-6 text-lg">Documento PDF Allegato</span>
                  <a 
                    href={attachment.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 border border-red-200 transition-colors"
                  >
                    Apri PDF in una nuova scheda
                  </a>
                </div>
              )}
              {(attachment.name.endsWith('.xls') || attachment.name.endsWith('.xlsx') || attachment.type.includes('spreadsheet') || attachment.type.includes('excel')) && (
                <div className="p-8 text-gray-500 flex flex-col items-center bg-white rounded-lg shadow-sm border border-gray-200">
                  <File size={64} className="mb-4 text-green-600 opacity-80" />
                  <span className="font-medium text-gray-700 text-lg">Foglio di Calcolo Allegato</span>
                  <span className="text-sm mt-2 mb-6 text-center max-w-md">
                    Il file excel è pronto per essere consultato.
                  </span>
                  <a 
                    href={attachment.url} 
                    download={attachment.name}
                    className="px-6 py-3 bg-green-50 text-green-700 rounded-md text-sm font-medium hover:bg-green-100 border border-green-200 transition-colors"
                  >
                    Apri Excel esternamente
                  </a>
                </div>
              )}
              {!attachment.type.startsWith('image/') && attachment.type !== 'application/pdf' && !(attachment.name.endsWith('.xls') || attachment.name.endsWith('.xlsx') || attachment.type.includes('spreadsheet') || attachment.type.includes('excel')) && (
                <div className="p-8 text-gray-500 flex flex-col items-center bg-white rounded-lg shadow-sm border border-gray-200">
                  <File size={64} className="mb-4 text-gray-400 opacity-80" />
                  <span className="font-medium text-gray-700 text-lg">File Allegato</span>
                  <span className="text-sm mt-2 mb-6 text-center max-w-md">
                    Nessuna anteprima visiva disponibile per questo formato.
                  </span>
                  <a 
                    href={attachment.url} 
                    download={attachment.name}
                    className="px-6 py-3 bg-gray-50 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-100 border border-gray-200 transition-colors"
                  >
                    Scarica / Apri file
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 bg-white">
            <FolderOpen size={64} className="text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-700 mb-2">Nessun documento caricato per "{activeTab}"</h3>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
              Allega un file PDF, Excel o Immagine per questa sezione.<br/> Il file rimarrà in memoria fino al suo invio in archivio.
            </p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-3 bg-[#3b4781] text-white rounded-md text-sm font-medium hover:bg-[#2d325a] transition-colors shadow-sm"
            >
              <Upload size={18} />
              <span>Scegli un file dal dispositivo</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal Nuova Scheda */}
      {isCreatingTab && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col">
            <h3 className="text-xl font-bold text-[#2d325a] mb-2">Crea Nuova Scheda</h3>
            <p className="text-sm text-gray-600 mb-4">Inserisci il nome per la nuova sezione di fatturazione:</p>
            <input
              type="text"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              placeholder="es. Energia Elettrica, TARI, Pulizie..."
              className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3b4781] mb-6 font-medium text-gray-800"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTabName.trim()) {
                  handleCreateTab();
                }
              }}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsCreatingTab(false);
                  setNewTabName('');
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md font-medium transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={handleCreateTab}
                disabled={!newTabName.trim()}
                className="px-4 py-2 bg-[#3b4781] hover:bg-[#2d325a] text-white rounded-md font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                Crea Scheda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rinomina Scheda */}
      {editingTab && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col">
            <h3 className="text-xl font-bold text-[#2d325a] mb-2">Rinomina Scheda</h3>
            <p className="text-sm text-gray-600 mb-4">Modifica il nome della sezione "{editingTab}":</p>
            <input
              type="text"
              value={editTabName}
              onChange={(e) => setEditTabName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3b4781] mb-6 font-medium text-gray-800"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editTabName.trim()) {
                  handleRenameTab();
                }
              }}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setEditingTab(null);
                  setEditTabName('');
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md font-medium transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={handleRenameTab}
                disabled={!editTabName.trim()}
                className="px-4 py-2 bg-[#3b4781] hover:bg-[#2d325a] text-white rounded-md font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                Salva Modifiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Elimina Scheda */}
      {deletingTab && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col">
            <h3 className="text-xl font-bold text-red-600 mb-2">Elimina Scheda</h3>
            <p className="text-sm text-gray-600 mb-6">
              Sei sicuro di voler eliminare la scheda <span className="font-semibold text-gray-800">"{deletingTab}"</span>?
              <br />
              <span className="text-xs text-gray-500 mt-1 block">
                Se è presente un documento caricato in questa scheda, verrà anch'esso rimosso.
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingTab(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md font-medium transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={handleDeleteTab}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors cursor-pointer"
              >
                Elimina Scheda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rinomina File */}
      {pendingFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col">
            <h3 className="text-xl font-bold text-[#2d325a] mb-2">Nomina Documento</h3>
            <p className="text-sm text-gray-600 mb-4">Scegli un nome per il file che stai allegando:</p>
            <input
              type="text"
              value={customFileName}
              onChange={(e) => setCustomFileName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3b4781] mb-6 font-medium text-gray-800"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customFileName.trim()) {
                  confirmFileUpload();
                }
              }}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelFileUpload}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confirmFileUpload}
                disabled={!customFileName.trim()}
                className="px-4 py-2 bg-[#3b4781] hover:bg-[#2d325a] text-white rounded-md font-medium transition-colors disabled:opacity-50"
              >
                Conferma e Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
