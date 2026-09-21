import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketToEdit?: any | null;
}

export default function TicketModal({ isOpen, onClose, ticketToEdit }: TicketModalProps) {
  const { user, canManageTicketStatus, canCreateTicket, role, isAdmin } = useAuth();
  const isTicketManagerOnly = role === 'ticket_manager' && !isAdmin;
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    tipoEvento: '',
    dataOra: '',
    risorsa: '',
    descrizione: '',
    note: '',
    titolo: '',
    priorita: 'Bassa',
    stato: 'Aperto',
    soluzione: ''
  });

  useEffect(() => {
    if (ticketToEdit && isOpen) {
      setFormData({
        tipoEvento: ticketToEdit.tipoEvento || '',
        dataOra: ticketToEdit.dataOra || '',
        risorsa: ticketToEdit.risorsa || '',
        descrizione: ticketToEdit.descrizione || '',
        note: ticketToEdit.note || '',
        titolo: ticketToEdit.titolo || '',
        priorita: ticketToEdit.priorita || 'Bassa',
        stato: ticketToEdit.stato || 'Aperto',
        soluzione: ticketToEdit.soluzione || ''
      });
    } else if (isOpen) {
      setFormData({
        tipoEvento: '',
        dataOra: '',
        risorsa: '',
        descrizione: '',
        note: '',
        titolo: '',
        priorita: 'Bassa',
        stato: 'Aperto',
        soluzione: ''
      });
    }
  }, [ticketToEdit, isOpen]);

  if (!isOpen) return null;

  if (!ticketToEdit && !canCreateTicket) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <X size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Apertura Ticket non consentita</h3>
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">
            Il tuo ruolo consente esclusivamente la <strong>gestione dei ticket</strong> (presa in carico, risposta fornitore, soluzione e chiusura). Non è consentita l'apertura o creazione di nuovi ticket.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#3b4781] hover:bg-[#2d325a] text-white rounded-md text-sm font-semibold transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!ticketToEdit && !canCreateTicket) {
      toast.error('Non hai i permessi per aprire nuovi ticket');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        ...formData
      };

      if (formData.stato === 'Presa in carico' || formData.stato === 'Chiusa') {
        payload.gestitoDa = user.email || 'operatore';
        payload.gestitoIl = Date.now();
      }

      if (ticketToEdit) {
        const ticketRef = doc(db, 'tickets', ticketToEdit.id);
        await updateDoc(ticketRef, payload);
        toast.success(
          formData.stato === 'Chiusa' 
            ? 'Ticket chiuso con successo!' 
            : formData.stato === 'Presa in carico'
            ? 'Ticket preso in carico e Risposta salvata!' 
            : 'Ticket aggiornato!'
        );
      } else {
        await addDoc(collection(db, 'tickets'), {
          ...payload,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        toast.success('Ticket aggiunto con successo!');
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, ticketToEdit ? OperationType.UPDATE : OperationType.CREATE, 'tickets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {ticketToEdit 
                ? (isTicketManagerOnly ? 'Gestione Ticket' : 'Modifica Registro') 
                : 'Nuovo Registro Giornaliero'}
            </h2>
            {isTicketManagerOnly && ticketToEdit && (
              <p className="text-xs text-amber-700 font-medium mt-0.5">
                Ruolo Gestore Ticket: aggiorna stato, risposta del fornitore e soluzione
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {isTicketManagerOnly && ticketToEdit && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
              <span className="text-base leading-none">ℹ️</span>
              <div>
                <strong className="block font-semibold mb-0.5">Segnalazione in consultazione</strong>
                I dettagli iniziali inseriti dal richiedente sono di sola lettura. Puoi gestire la <strong>Risposta del fornitore</strong>, modificare lo <strong>Stato</strong> e registrare la <strong>Soluzione / Note operative</strong>.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Titolo e Priorità (aggiunti per edit) */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Titolo</label>
              <input
                name="titolo"
                disabled={isTicketManagerOnly}
                value={formData.titolo}
                onChange={handleChange}
                className={`h-10 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent ${
                  isTicketManagerOnly ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                }`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Priorità</label>
              <select
                name="priorita"
                disabled={isTicketManagerOnly}
                value={formData.priorita}
                onChange={handleChange}
                className={`h-10 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent bg-white ${
                  isTicketManagerOnly ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                }`}
              >
                <option value="Bassa">Bassa</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </div>

            {/* Tipo Evento + Add Button */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-xs font-semibold text-gray-600">Tipo Evento</label>
              <div className="flex items-center gap-2">
                <input
                  name="tipoEvento"
                  disabled={isTicketManagerOnly}
                  value={formData.tipoEvento}
                  onChange={handleChange}
                  className={`flex-1 h-10 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent ${
                    isTicketManagerOnly ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                  }`}
                />
                {!isTicketManagerOnly && (
                  <button type="button" className="w-10 h-10 rounded-full bg-[#3b4781] text-white flex items-center justify-center hover:bg-[#2d325a] transition-colors shrink-0 shadow-sm">
                    <Plus size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Data e Ora */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Data e Ora</label>
              <input
                type="datetime-local"
                name="dataOra"
                disabled={isTicketManagerOnly}
                value={formData.dataOra}
                onChange={handleChange}
                className={`h-10 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent ${
                  isTicketManagerOnly ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                }`}
              />
            </div>

            {/* Risorsa */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-600">Risorsa / Fornitore</label>
              <input
                name="risorsa"
                disabled={isTicketManagerOnly}
                value={formData.risorsa}
                onChange={handleChange}
                className={`h-10 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent ${
                  isTicketManagerOnly ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                }`}
              />
            </div>

            {/* Descrizione Evento */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-600">Descrizione Evento *</label>
              <textarea
                required
                disabled={isTicketManagerOnly}
                name="descrizione"
                value={formData.descrizione}
                onChange={handleChange}
                rows={3}
                className={`w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent resize-y ${
                  isTicketManagerOnly ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                }`}
              />
            </div>

            {/* Risposta del fornitore */}
            <div className={`flex flex-col gap-1.5 md:col-span-2 p-3 rounded-lg transition-all ${
              formData.stato === 'Presa in carico'
                ? 'bg-amber-50/70 border-2 border-amber-400/80 shadow-xs'
                : 'border border-gray-200 bg-gray-50/30'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="text-xs font-bold text-[#2d325a]">Risposta del fornitore</label>
                {formData.stato === 'Presa in carico' && (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                    🟡 In carico: scrivi qui la risposta ricevuta dal fornitore
                  </span>
                )}
              </div>
              <textarea
                name="note"
                value={formData.note}
                onChange={handleChange}
                placeholder="Inserisci la risposta del fornitore, preventivo o tempistiche di intervento..."
                rows={formData.stato === 'Presa in carico' ? 3 : 2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent resize-y bg-white"
              />
            </div>

            {/* Gestione e Soluzione Ticket (visibile per operatori/gestori o in modifica) */}
            {(canManageTicketStatus || ticketToEdit) && (
              <div className="md:col-span-2 bg-blue-50/60 p-3.5 rounded-lg border border-blue-100 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2d325a] uppercase tracking-wide">
                    Stato di Gestione & Risoluzione
                  </span>
                  {ticketToEdit?.gestitoDa && (
                    <span className="text-[11px] text-gray-500">
                      Ultima gestione: <strong>{ticketToEdit.gestitoDa}</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className={`flex items-center gap-2 p-2.5 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                    formData.stato === 'Aperto' 
                      ? 'bg-white border-blue-500 text-blue-800 shadow-xs ring-2 ring-blue-200' 
                      : 'bg-white/60 border-gray-200 text-gray-600 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="stato"
                      value="Aperto"
                      checked={formData.stato === 'Aperto'}
                      onChange={handleChange}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>🔵 Aperto</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                    formData.stato === 'Presa in carico' 
                      ? 'bg-white border-amber-500 text-amber-800 shadow-xs ring-2 ring-amber-200' 
                      : 'bg-white/60 border-gray-200 text-gray-600 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="stato"
                      value="Presa in carico"
                      checked={formData.stato === 'Presa in carico'}
                      onChange={handleChange}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>🟡 Presa in carico</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                    formData.stato === 'Chiusa' 
                      ? 'bg-white border-green-500 text-green-800 shadow-xs ring-2 ring-green-200' 
                      : 'bg-white/60 border-gray-200 text-gray-600 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="stato"
                      value="Chiusa"
                      checked={formData.stato === 'Chiusa'}
                      onChange={handleChange}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span>🟢 Chiusa</span>
                  </label>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  <label className="text-xs font-semibold text-gray-600">
                    Soluzione / Note di Lavorazione
                  </label>
                  <textarea
                    name="soluzione"
                    placeholder="Descrivi l'intervento effettuato, le azioni intraprese o il motivo della chiusura..."
                    value={formData.soluzione}
                    onChange={handleChange}
                    rows={2}
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent resize-y"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Modal Footer */}
          <div className="border-t border-gray-100 mt-6 pt-4 pb-2 flex justify-end gap-3 sticky bottom-0 bg-white">
            <button 
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold text-[#3b4781] hover:bg-gray-50 rounded transition-colors"
            >
              CHIUDI
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold text-white bg-[#3b4781] hover:bg-[#2d325a] rounded shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {ticketToEdit ? (isTicketManagerOnly ? 'SALVA GESTIONE TICKET' : 'SALVA MODIFICHE') : 'INSERISCI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
