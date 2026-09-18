import React, { useState, useRef, useEffect } from 'react';
import { Upload, File, FileText, Image as ImageIcon, X, Archive, FolderOpen } from 'lucide-react';
import { getTabAttachment, saveTabAttachment, removeTabAttachment, saveToArchive } from './storage';

export default function FatturazioneView() {
  const [activeTab, setActiveTab] = useState('Acqua');
  const [attachment, setAttachment] = useState<{ name: string, type: string, url: string, file: File } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Remove the extension to allow the user to type the name easily, but optionally we can keep it.
    // Let's pre-fill with the full name for simplicity, they can edit it.
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

  const tabs = [
    'Acqua', 'Lettura contatori', 'Costi di gestione', 'Freddo', 
    'Pertinenze celle-magazzini', 'Pertinenze parcheggi', 'Scarti ittici'
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-[#2d325a]">Fatturazione e Ripartizione Spese</h2>
          <p className="text-sm text-gray-500">Gestisci i documenti per ogni sezione</p>
        </div>
        
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
      </div>

      <div className="flex overflow-x-auto bg-white border-b border-gray-200 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab 
                ? 'border-[#3b4781] text-[#3b4781]' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-6">
        {attachment ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col h-full overflow-hidden">
            <div className="bg-blue-50/50 p-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h4 className="font-semibold text-[#2d325a] flex items-center gap-2 text-sm">
                {attachment.type.startsWith('image/') ? <ImageIcon size={18} className="text-blue-500" /> : attachment.type === 'application/pdf' ? <FileText size={18} className="text-red-500" /> : <File size={18} className="text-green-600" />}
                Documento di riferimento ({activeTab}): <span className="font-normal text-gray-600">{attachment.name}</span>
              </h4>
              <div className="flex items-center gap-2">
                <button onClick={clearAttachment} className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-full hover:bg-white" title="Rimuovi">
                  <X size={18} />
                </button>
              </div>
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
