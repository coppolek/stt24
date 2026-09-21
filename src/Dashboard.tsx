import React, { useState, useEffect } from 'react';
import { 
  Home, Link, Trash2, Edit, Plus,
  Filter, LogOut, Copy, Search, Wrench, FileText, Users, Download, Calculator, FolderOpen,
  Clock, CheckCircle2, RotateCcw
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { logout, db, handleFirestoreError, OperationType } from './firebase';
import { collection, onSnapshot, query, where, orderBy, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
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
  stato?: 'Aperto' | 'Presa in carico' | 'Chiusa';
  soluzione?: string;
  gestitoDa?: string;
  gestitoIl?: any;
  userId: string;
  createdAt: any;
}

interface TicketListProps {
  onOpenModal: (ticket?: Ticket) => void;
}

function TicketList({ onOpenModal }: TicketListProps) {
  const { user, isWriter, canCreateTicket, canManageTicketStatus, isAdmin } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [priorityFilter, setPriorityFilter] = useState('Tutte');
  const [statusFilter, setStatusFilter] = useState('Tutti');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Modal Presa in carico & Risposta del Fornitore
  const [takeInChargeTicket, setTakeInChargeTicket] = useState<Ticket | null>(null);
  const [providerResponseText, setProviderResponseText] = useState('');
  const [solutionText, setSolutionText] = useState('');
  const [targetStatus, setTargetStatus] = useState<'Presa in carico' | 'Chiusa'>('Presa in carico');
  const [isSavingTakeInCharge, setIsSavingTakeInCharge] = useState(false);

  const openTakeInChargeModal = (ticket: Ticket, forceStatus?: 'Presa in carico' | 'Chiusa') => {
    setTakeInChargeTicket(ticket);
    setProviderResponseText(ticket.note || '');
    setSolutionText(ticket.soluzione || '');
    setTargetStatus(forceStatus || (ticket.stato === 'Chiusa' ? 'Chiusa' : 'Presa in carico'));
  };

  const handleSaveTakeInCharge = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!takeInChargeTicket) return;
    setIsSavingTakeInCharge(true);
    try {
      await updateDoc(doc(db, 'tickets', takeInChargeTicket.id), {
        stato: targetStatus,
        note: providerResponseText.trim(),
        soluzione: solutionText.trim(),
        gestitoDa: user?.email || 'operatore',
        gestitoIl: Date.now()
      });
      toast.success(
        targetStatus === 'Chiusa' 
          ? 'Ticket chiuso con successo!' 
          : 'Ticket preso in carico e Risposta del fornitore registrata!'
      );
      setTakeInChargeTicket(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tickets');
    } finally {
      setIsSavingTakeInCharge(false);
    }
  };

  const handleQuickTakeInCharge = async () => {
    if (!takeInChargeTicket) return;
    setIsSavingTakeInCharge(true);
    try {
      await updateDoc(doc(db, 'tickets', takeInChargeTicket.id), {
        stato: 'Presa in carico',
        gestitoDa: user?.email || 'operatore',
        gestitoIl: Date.now()
      });
      toast.success('Ticket preso in carico!');
      setTakeInChargeTicket(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tickets');
    } finally {
      setIsSavingTakeInCharge(false);
    }
  };

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
    
    const headers = ['ID', 'Data', 'Titolo', 'Tipo Evento', 'Priorità', 'Stato', 'Soluzione', 'Gestito Da', 'Risorsa', 'Descrizione', 'Risposta del fornitore', 'Creato Da'];
    const csvRows = [headers.join(',')];

    filteredTickets.forEach(ticket => {
      const row = [
        `"${ticket.id}"`,
        `"${ticket.dataOra || ''}"`,
        `"${(ticket.titolo || '').replace(/"/g, '""')}"`,
        `"${(ticket.tipoEvento || '').replace(/"/g, '""')}"`,
        `"${ticket.priorita || ''}"`,
        `"${ticket.stato || 'Aperto'}"`,
        `"${(ticket.soluzione || '').replace(/"/g, '""')}"`,
        `"${ticket.gestitoDa || ''}"`,
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

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: 'Aperto' | 'Presa in carico' | 'Chiusa') => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        stato: newStatus,
        gestitoDa: user?.email || 'operatore',
        gestitoIl: Date.now()
      });
      toast.success(
        newStatus === 'Chiusa' 
          ? 'Ticket chiuso con successo!' 
          : newStatus === 'Presa in carico' 
          ? 'Ticket preso in carico!' 
          : 'Ticket riaperto!'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tickets');
    }
  };

  const handleBulkUpdateStatus = async (newStatus: 'Presa in carico' | 'Chiusa') => {
    if (selectedTickets.size === 0) return;
    try {
      const promises = Array.from(selectedTickets).map((id: string) =>
        updateDoc(doc(db, 'tickets', id), {
          stato: newStatus,
          gestitoDa: user?.email || 'operatore',
          gestitoIl: Date.now()
        })
      );
      await Promise.all(promises);
      toast.success(
        newStatus === 'Chiusa'
          ? `${selectedTickets.size} ticket chiusi!`
          : `${selectedTickets.size} ticket presi in carico!`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tickets');
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (priorityFilter !== 'Tutte') {
      const ticketPriority = t.priorita || 'Bassa';
      if (ticketPriority !== priorityFilter) return false;
    }

    if (statusFilter !== 'Tutti') {
      const ticketStatus = t.stato || 'Aperto';
      if (ticketStatus !== statusFilter) return false;
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
  const canModifySelected = Array.from(selectedTickets).every((id: string) => {
    const ticket = tickets.find(t => t.id === id);
    return ticket && (ticket.userId === user?.uid || canManageTicketStatus || isWriter || isAdmin);
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
          <div className="flex items-center gap-2 flex-wrap">
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

            {/* Azioni rapide di massa per cambio stato */}
            {canManageTicketStatus && selectedTickets.size > 0 && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
                <button
                  onClick={() => handleBulkUpdateStatus('Presa in carico')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                  title="Prendi in carico i ticket selezionati"
                >
                  <Clock size={14} /> In carico ({selectedTickets.size})
                </button>
                <button
                  onClick={() => handleBulkUpdateStatus('Chiusa')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                  title="Chiudi i ticket selezionati"
                >
                  <CheckCircle2 size={14} /> Chiudi ({selectedTickets.size})
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-medium hidden sm:inline">Stato:</span>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 border border-gray-300 rounded px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] bg-white text-gray-700"
              >
                <option value="Tutti">Tutti gli stati</option>
                <option value="Aperto">🔵 Aperti</option>
                <option value="Presa in carico">🟡 Presi in carico</option>
                <option value="Chiusa">🟢 Chiusi</option>
              </select>
            </div>

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
        <table className="w-full min-w-[950px] border-collapse text-sm text-left">
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
              <th className="px-4 py-3 font-medium border-b border-r border-gray-300">Stato & Gestione</th>
              <th className="px-4 py-3 font-medium border-b border-r border-gray-300">Risorsa</th>
              <th className="px-4 py-3 font-medium border-b border-r border-gray-300">Descrizione Registro</th>
              <th className="px-4 py-3 font-medium border-b border-r border-gray-300">Risposta del fornitore</th>
              <th className="px-4 py-3 font-medium border-b border-gray-300">Data Evento</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
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
                  <td className="px-4 py-3 border-r border-gray-100 text-gray-700">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ticket.stato === 'Chiusa' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 size={13} className="text-emerald-600" /> Chiusa
                          </span>
                        ) : ticket.stato === 'Presa in carico' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <Clock size={13} className="text-amber-600" /> In carico
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            🔵 Aperto
                          </span>
                        )}

                        {/* Pulsanti rapidi per gestire il ticket con soluzioni: Presa in carico / Chiusa */}
                        {canManageTicketStatus && (
                          <div className="flex items-center gap-1">
                            {(!ticket.stato || ticket.stato === 'Aperto') && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openTakeInChargeModal(ticket, 'Presa in carico'); }}
                                  className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-medium transition-colors shadow-2xs"
                                  title="Prendi in carico questo ticket e scrivi la Risposta del fornitore"
                                >
                                  Prendi in carico
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdateTicketStatus(ticket.id, 'Chiusa'); }}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium transition-colors shadow-2xs"
                                  title="Chiudi questo ticket"
                                >
                                  Chiudi
                                </button>
                              </>
                            )}

                            {ticket.stato === 'Presa in carico' && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openTakeInChargeModal(ticket, 'Presa in carico'); }}
                                  className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[11px] font-medium transition-colors shadow-2xs"
                                  title="Modifica o scrivi la Risposta del fornitore"
                                >
                                  Risposta fornitore
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdateTicketStatus(ticket.id, 'Chiusa'); }}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium transition-colors shadow-2xs"
                                  title="Chiudi questo ticket"
                                >
                                  Chiudi
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdateTicketStatus(ticket.id, 'Aperto'); }}
                                  className="px-1.5 py-0.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[11px] transition-colors"
                                  title="Riapri ticket"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              </>
                            )}

                            {ticket.stato === 'Chiusa' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUpdateTicketStatus(ticket.id, 'Aperto'); }}
                                className="px-2 py-0.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[11px] font-medium transition-colors flex items-center gap-1"
                                title="Riapri ticket"
                              >
                                <RotateCcw size={11} /> Riapri
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {ticket.soluzione && (
                        <div className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1 max-w-xs">
                          <span className="font-semibold text-gray-700">Soluzione:</span> {ticket.soluzione}
                        </div>
                      )}

                      {ticket.gestitoDa && (
                        <div className="text-[10px] text-gray-400">
                          Operatore: {ticket.gestitoDa}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 border-r border-gray-100 text-gray-700">{ticket.risorsa || '-'}</td>
                  <td className="px-4 py-3 border-r border-gray-100 text-gray-700">{ticket.descrizione}</td>
                  <td className="px-4 py-3 border-r border-gray-100 text-gray-700">
                    {ticket.note ? (
                      <div 
                        onClick={() => (canManageTicketStatus || isWriter || isAdmin) && openTakeInChargeModal(ticket)}
                        className={`group flex items-start justify-between gap-1.5 p-1 rounded transition-colors ${
                          (canManageTicketStatus || isWriter || isAdmin) ? 'hover:bg-amber-50 cursor-pointer' : ''
                        }`}
                        title={(canManageTicketStatus || isWriter || isAdmin) ? 'Clicca per modificare la Risposta del fornitore' : ''}
                      >
                        <span className="text-xs text-gray-700 leading-relaxed max-w-[220px] break-words">
                          {ticket.note}
                        </span>
                        {(canManageTicketStatus || isWriter || isAdmin) && (
                          <Edit size={13} className="text-gray-400 group-hover:text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    ) : (
                      (canManageTicketStatus || isWriter || isAdmin) ? (
                        <button
                          onClick={() => openTakeInChargeModal(ticket, ticket.stato === 'Aperto' ? 'Presa in carico' : undefined)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                            ticket.stato === 'Presa in carico'
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 shadow-2xs font-semibold'
                              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                          }`}
                          title="Inserisci Risposta del fornitore"
                        >
                          <Edit size={11} /> {ticket.stato === 'Presa in carico' ? '+ Scrivi risposta' : '-'}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )
                    )}
                  </td>
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
      {/* Modal Presa in carico & Risposta del Fornitore */}
      {takeInChargeTicket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#2d325a] px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 rounded-lg text-amber-300">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {takeInChargeTicket.stato === 'Presa in carico' 
                      ? 'Risposta del Fornitore' 
                      : 'Presa in carico Ticket & Risposta Fornitore'}
                  </h3>
                  <p className="text-xs text-gray-300">
                    {takeInChargeTicket.titolo || takeInChargeTicket.tipoEvento || 'Ticket'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTakeInChargeTicket(null)}
                className="text-gray-300 hover:text-white p-1 rounded hover:bg-white/10 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTakeInCharge} className="p-5 flex flex-col gap-4">
              {/* Riepilogo ticket */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Risorsa / Fornitore:</span>
                  <span className="font-semibold text-gray-800">{takeInChargeTicket.risorsa || 'Non specificata'}</span>
                </div>
                {takeInChargeTicket.descrizione && (
                  <div className="pt-1.5 border-t border-gray-200">
                    <span className="text-gray-500 block mb-0.5">Descrizione registro:</span>
                    <span className="text-gray-700 italic">{takeInChargeTicket.descrizione}</span>
                  </div>
                )}
              </div>

              {/* Selettore stato */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700">Stato del Ticket</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetStatus('Presa in carico')}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      targetStatus === 'Presa in carico'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-200 shadow-xs'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Clock size={14} className="text-amber-600" /> Presa in carico
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetStatus('Chiusa')}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      targetStatus === 'Chiusa'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200 shadow-xs'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle2 size={14} className="text-emerald-600" /> Risolto / Chiuso
                  </button>
                </div>
              </div>

              {/* Campo Principale: Risposta del fornitore */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#2d325a]">
                    Risposta del fornitore
                  </label>
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                    Scrivi qui la risposta ricevuta
                  </span>
                </div>
                <textarea
                  autoFocus
                  value={providerResponseText}
                  onChange={(e) => setProviderResponseText(e.target.value)}
                  placeholder="Inserisci qui la risposta fornita dal fornitore, tempistiche di intervento, preventivo o note fornite..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-y"
                />
              </div>

              {/* Campo Soluzione / Note operative */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700">
                  Soluzione / Note operative (opzionale)
                </label>
                <textarea
                  value={solutionText}
                  onChange={(e) => setSolutionText(e.target.value)}
                  placeholder="Note interne dell'operatore o soluzione adottata..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent resize-y"
                />
              </div>

              {/* Bottoni azione */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTakeInChargeTicket(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
                >
                  Annulla
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  {takeInChargeTicket.stato !== 'Presa in carico' && (
                    <button
                      type="button"
                      disabled={isSavingTakeInCharge}
                      onClick={handleQuickTakeInCharge}
                      className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Imposta stato su Presa in carico senza inserire risposta adesso"
                    >
                      In carico senza risposta
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingTakeInCharge}
                    className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    {isSavingTakeInCharge ? 'Salvataggio...' : 'Salva e Conferma'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  : role === 'ticket_manager'
                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                  : role === 'ticket_only'
                  ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                  : role === 'writer'
                  ? 'bg-blue-500/30 text-blue-200 border border-blue-400/40'
                  : 'bg-gray-500/30 text-gray-200 border border-gray-400/40'
              }`}>
                {role === 'ticket_manager' ? 'Gestore Ticket' : role === 'ticket_only' ? 'Operatore Ticket' : role || 'Viewer'}
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
              <p className="max-w-md mb-6">
                Il tuo account <strong>{user?.email}</strong> non ha ancora i permessi necessari per accedere a questa applicazione. Contatta l'amministratore per farti assegnare un ruolo.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-[#3b4781] hover:bg-[#2d325a] text-white text-xs font-semibold rounded-md transition-colors shadow-xs"
                >
                  Aggiorna Stato
                </button>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-md transition-colors"
                >
                  Disconnetti
                </button>
              </div>
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
