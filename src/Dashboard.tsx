import React, { useState, useEffect } from 'react';
import { 
  Home, Link, Trash2, Edit, Plus,
  Filter, LogOut, Copy, Search, Wrench, FileText, Users, Download, Calculator, FolderOpen
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { logout, db, handleFirestoreError, OperationType } from './firebase';
import { collection, onSnapshot, query, where, orderBy, addDoc, doc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import TicketModal from './TicketModal';
import RoleManager from './RoleManager';
import FatturazioneView from './FatturazioneView';
import ArchivioFatturazioneView from './ArchivioFatturazioneView';
import { toast } from 'react-hot-toast';

export interface Ticket {
  id: string;
  titolo?: string;
  priorita?: string;
  tipoEvento?: string;
  dataOra?: string;
  risorsa?: string;
  descrizione: string;
  note?: string;
  userId: string;
  createdAt: any;
}

interface TicketListProps {
  onOpenModal: (ticket?: Ticket) => void;
}

function TicketList({ onOpenModal }: TicketListProps) {
  const { user, isWriter, canCreateTicket, isAdmin } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [priorityFilter, setPriorityFilter] = useState('Tutte');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'tickets'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTickets: Ticket[] = [];
      snapshot.forEach((doc) => {
        fetchedTickets.push({ id: doc.id, ...doc.data() } as Ticket);
      });
      setTickets(fetchedTickets);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tickets');
    });

    return () => unsubscribe();
  }, [user]);

  const toggleSelection = (ticketId: string) => {
    const newSelection = new Set(selectedTickets);
    if (newSelection.has(ticketId)) {
      newSelection.delete(ticketId);
    } else {
      newSelection.add(ticketId);
    }
    setSelectedTickets(newSelection);
  };

  const toggleAllSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTickets(new Set(filteredTickets.map(t => t.id)));
    } else {
      setSelectedTickets(new Set());
    }
  };

  const confirmDelete = async () => {
    if (selectedTickets.size === 0) return;

    try {
      const deletePromises = Array.from(selectedTickets).map((id: string) => 
        deleteDoc(doc(db, 'tickets', id))
      );
      await Promise.all(deletePromises);
      setSelectedTickets(new Set());
      setShowDeleteConfirm(false);
      toast.success('Ticket eliminato con successo!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tickets');
    }
  };

  const handleDelete = () => {
    if (selectedTickets.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const handleEdit = () => {
    if (selectedTickets.size !== 1) return;
    const ticketId = Array.from(selectedTickets)[0];
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      onOpenModal(ticket);
    }
  };

  const handleCopyLink = () => {
    if (selectedTickets.size !== 1) return;
    const ticketId = Array.from(selectedTickets)[0];
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      const details = `Ticket: ${ticket.titolo || ticket.tipoEvento || 'N/A'}\nDescrizione: ${ticket.descrizione}\nPriorità: ${ticket.priorita || 'Bassa'}`;
      navigator.clipboard.writeText(details)
        .then(() => {
          toast.success('Copiato negli appunti!');
        })
        .catch(() => toast.error('Errore durante la copia.'));
    }
  };

  const handleExportCSV = () => {
    if (filteredTickets.length === 0) {
      toast.error('Nessun ticket da esportare');
      return;
    }
    
    const headers = ['ID', 'Data', 'Titolo', 'Tipo Evento', 'Priorità', 'Risorsa', 'Descrizione', 'Note', 'Creato Da'];
    const csvRows = [headers.join(',')];

    filteredTickets.forEach(ticket => {
      const row = [
        `"${ticket.id}"`,
        `"${ticket.dataOra || ''}"`,
        `"${(ticket.titolo || '').replace(/"/g, '""')}"`,
        `"${(ticket.tipoEvento || '').replace(/"/g, '""')}"`,
        `"${ticket.priorita || ''}"`,
        `"${(ticket.risorsa || '').replace(/"/g, '""')}"`,
        `"${(ticket.descrizione || '').replace(/"/g, '""')}"`,
        `"${(ticket.note || '').replace(/"/g, '""')}"`,
        `"${ticket.userId}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tickets_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Esportazione completata!');
  };

  const filteredTickets = tickets.filter(t => {
    if (priorityFilter !== 'Tutte') {
      const ticketPriority = t.priorita || 'Bassa';
      if (ticketPriority !== priorityFilter) return false;
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const titleMatch = (t.titolo || '').toLowerCase().includes(term) || (t.tipoEvento || '').toLowerCase().includes(term);
      const descMatch = (t.descrizione || '').toLowerCase().includes(term);
      if (!titleMatch && !descMatch) return false;
    }

    return true;
  });

  // Calculate if the user can modify the selected items
  const canModifySelected = Array.from(selectedTickets).every(id => {
    const ticket = tickets.find(t => t.id === id);
    return ticket && (ticket.userId === user?.uid || isAdmin);
  });

  return (
    <div className="bg-white shadow-sm border border-gray-200 flex-1 flex flex-col min-h-0 mx-4 mb-4 rounded-md">
      {/* Header & Toolbar */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center">
            <h1 className="text-[#2d325a] font-semibold text-lg">Registro Giornaliero</h1>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Cerca ticket..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] w-64 bg-white"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        <div className="px-4 py-2 flex justify-between items-center bg-gray-50/50 flex-wrap gap-4">
          <div className="flex gap-2">
            {canCreateTicket && (
              <button 
                onClick={() => onOpenModal()}
                className="w-10 h-10 rounded-full bg-[#3b4781] text-white flex items-center justify-center hover:bg-[#2d325a] transition-colors shadow-sm"
                title="Nuovo Registro (Esteso)"
              >
                <Plus size={20} />
              </button>
            )}
            {isWriter && (
              <button 
                onClick={handleEdit}
                disabled={selectedTickets.size !== 1 || !canModifySelected}
                className={`w-10 h-10 rounded-full text-white flex items-center justify-center transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${(selectedTickets.size === 1 && canModifySelected) ? 'bg-[#3b4781] hover:bg-[#2d325a]' : 'bg-gray-400'}`}
                title="Modifica"
              >
                <Edit size={18} />
              </button>
            )}
            {isWriter && (
              <button 
                onClick={handleDelete}
                disabled={selectedTickets.size === 0 || !canModifySelected}
                className={`w-10 h-10 rounded-full text-white flex items-center justify-center transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${(selectedTickets.size > 0 && canModifySelected) ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-400'}`}
                title="Elimina"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button 
              onClick={handleCopyLink}
              disabled={selectedTickets.size !== 1}
              className={`w-10 h-10 rounded-full text-white flex items-center justify-center transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${selectedTickets.size === 1 ? 'bg-[#3b4781] hover:bg-[#2d325a]' : 'bg-gray-400'}`}
              title="Copia dettagli"
            >
              <Link size={18} />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-medium hidden sm:inline">Filtra:</span>
              <select 
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-9 border border-gray-300 rounded px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] bg-white text-gray-700"
              >
                <option value="Tutte">Tutte le priorità</option>
                <option value="Bassa">Bassa</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
            {isAdmin && (
              <button 
                onClick={handleExportCSV}
                className="w-10 h-10 rounded-full bg-[#3b4781] text-white flex items-center justify-center hover:bg-[#2d325a] transition-colors shadow-sm"
                title="Esporta CSV"
              >
                <Download size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <table className="w-full min-w-[800px] border-collapse text-sm text-left">
          <thead className="bg-gray-200/50 text-gray-500 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 font-medium border-b border-r border-gray-300 w-12 text-center">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-[#3b4781] focus:ring-[#3b4781]"
                  checked={filteredTickets.length > 0 && selectedTickets.size === filteredTickets.length}
                  onChange={toggleAllSelection}
                />
              </th>
              <th className="px-4 py-3 font-medium border-b border-r border-gray-300">Titolo (Priorità)</th>
              <th className="px-4 py-3 font-medium border-b border-r border-gray-300">Risorsa</th>
              <th className="px-4 py-3 font-medium border-b border-r border-gray-300">Descrizione Registro</th>
              <th className="px-4 py-3 font-medium border-b border-r border-gray-300">Note</th>
              <th className="px-4 py-3 font-medium border-b border-gray-300">Data Evento</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Nessun registro trovato per i filtri selezionati.
                </td>
              </tr>
            ) : (
              filteredTickets.map((ticket, idx) => (
                <tr key={ticket.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedTickets.has(ticket.id) ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-4 py-3 border-r border-gray-100 text-center">
                     <input 
                       type="checkbox" 
                       className="rounded border-gray-300 text-[#3b4781] focus:ring-[#3b4781]" 
                       checked={selectedTickets.has(ticket.id)}
                       onChange={() => toggleSelection(ticket.id)}
                     />
                  </td>
                  <td className="px-4 py-3 border-r border-gray-100 text-gray-700">
                    {ticket.titolo || ticket.tipoEvento ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#2d325a]">{ticket.titolo || ticket.tipoEvento}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase whitespace-nowrap ${
                          ticket.priorita === 'Alta' ? 'bg-red-100 text-red-700' : 
                          ticket.priorita === 'Media' ? 'bg-orange-100 text-orange-700' : 
                          'bg-green-100 text-green-700'
                        }`}>{ticket.priorita || 'Bassa'}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 border-r border-gray-100 text-gray-700">{ticket.risorsa || '-'}</td>
                  <td className="px-4 py-3 border-r border-gray-100 text-gray-700">{ticket.descrizione}</td>
                  <td className="px-4 py-3 border-r border-gray-100 text-gray-500 truncate max-w-[150px]" title={ticket.note || ''}>{ticket.note || '-'}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {ticket.dataOra ? format(new Date(ticket.dataOra), 'dd/MM/yyyy HH:mm', { locale: it }) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer Pagination */}
      <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-end text-xs text-gray-500 bg-gray-50">
        <span className="mr-4">Selezionati: {selectedTickets.size}</span>
        <span className="mr-4">Elementi: {filteredTickets.length}</span>
        <span className="mr-4">1 di 1</span>
        <div className="flex gap-2">
          <button className="px-1 hover:text-gray-800 disabled:opacity-50">&lt;&lt;</button>
          <button className="px-1 hover:text-gray-800 disabled:opacity-50">&lt;</button>
          <button className="px-1 hover:text-gray-800 disabled:opacity-50">&gt;</button>
          <button className="px-1 hover:text-gray-800 disabled:opacity-50">&gt;&gt;</button>
        </div>
      </div>

      {/* Modals & Notifications */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 flex flex-col items-center text-center">
            <Trash2 size={48} className="text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">Conferma Eliminazione</h3>
            <p className="text-sm text-gray-600 mb-6">
              Sei sicuro di voler eliminare {selectedTickets.size} {selectedTickets.size === 1 ? 'ticket' : 'ticket'}? Questa operazione è irreversibile.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-semibold transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-semibold transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, isAdmin, isViewer, role } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);
  const [ticketToEdit, setTicketToEdit] = useState<Ticket | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'fatturazione' | 'archiviazione'>('home');

  const handleOpenModal = (ticket?: Ticket) => {
    setTicketToEdit(ticket || null);
    setIsModalOpen(true);
  };

  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-16 bg-[#2d325a] flex flex-col items-center py-4 flex-shrink-0 z-20">
        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center mb-6 text-white text-xs font-bold uppercase">
          Stt24
        </div>
        <nav className="flex flex-col gap-6 text-gray-300 w-full">
          <button 
            onClick={() => setCurrentView('home')}
            className={`flex justify-center transition-colors ${currentView === 'home' ? 'text-white' : 'hover:text-white'}`} 
            title="Home"
          >
            <Home size={20} />
          </button>
          <button 
            onClick={() => setCurrentView('fatturazione')}
            className={`flex justify-center transition-colors ${currentView === 'fatturazione' ? 'text-white' : 'hover:text-white'}`} 
            title="Fatturazione e Spese"
          >
            <Calculator size={20} />
          </button>
          <button 
            onClick={() => setCurrentView('archiviazione')}
            className={`flex justify-center transition-colors ${currentView === 'archiviazione' ? 'text-white' : 'hover:text-white'}`} 
            title="Archivio Documenti"
          >
            <FolderOpen size={20} />
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 bg-[#2d325a] flex items-center justify-between px-4 text-white shadow-md z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-wide text-sm">Stt24 Web Container</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 px-3 py-1 rounded text-xs font-medium">
                {user?.email}
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                role === 'admin' 
                  ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40' 
                  : role === 'ticket_only'
                  ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                  : role === 'writer'
                  ? 'bg-blue-500/30 text-blue-200 border border-blue-400/40'
                  : 'bg-gray-500/30 text-gray-200 border border-gray-400/40'
              }`}>
                {role === 'ticket_only' ? 'Operatore Ticket' : role || 'Viewer'}
              </span>
            </div>
            {isAdmin && (
              <button 
                onClick={() => setIsRoleManagerOpen(true)}
                className="hover:text-blue-300 transition-colors" 
                title="Gestione Utenti"
              >
                <Users size={18} />
              </button>
            )}
            <button onClick={logout} className="hover:text-red-300 transition-colors" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Dashboard Area */}
        <main className="flex-1 overflow-auto bg-gray-100 relative flex flex-col">
          {!isViewer ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-500">
              <Users size={48} className="mb-4 text-gray-400" />
              <h2 className="text-2xl font-semibold mb-2 text-gray-700">In attesa di approvazione</h2>
              <p className="max-w-md">
                Il tuo account <strong>{user?.email}</strong> non ha ancora i permessi necessari per accedere a questa applicazione. Contatta l'amministratore per farti assegnare un ruolo.
              </p>
            </div>
          ) : currentView === 'home' ? (
            <TicketList onOpenModal={handleOpenModal} />
          ) : currentView === 'fatturazione' ? (
            <FatturazioneView />
          ) : (
            <ArchivioFatturazioneView />
          )}
        </main>
      </div>

      {/* Ticket Modal */}
      <TicketModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        ticketToEdit={ticketToEdit}
      />

      {isRoleManagerOpen && (
        <RoleManager onClose={() => setIsRoleManagerOpen(false)} />
      )}
    </div>
  );
}
