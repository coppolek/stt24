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
  const { user, canManageTicketStatus } = useAuth();
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
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
            ? 'Ticket preso in carico!'
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
        <div className="px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">{ticketToEdit ? 'Modifica Registro' : 'Nuovo Registro Giornaliero'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-2 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Titolo e Priorità (aggiunti per edit) */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Titolo</label>
              <input
                name="titolo"
                value={formData.titolo}
                onChange={handleChange}
                className="h-10 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Priorità</label>
              <select
                name="priorita"
                value={formData.priorita}
                onChange={handleChange}
                className="h-10 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent bg-white"
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
                  value={formData.tipoEvento}
                  onChange={handleChange}
                  className="flex-1 h-10 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent"
                />
                <button type="button" className="w-10 h-10 rounded-full bg-[#3b4781] text-white flex items-center justify-center hover:bg-[#2d325a] transition-colors shrink-0 shadow-sm">
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {/* Data e Ora */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Data e Ora</label>
              <input
                type="datetime-local"
                name="dataOra"
                value={formData.dataOra}
                onChange={handleChange}
                className="h-10 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent"
              />
            </div>

            {/* Risorsa */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-600">Risorsa</label>
              <input
                name="risorsa"
                value={formData.risorsa}
                onChange={handleChange}
                className="h-10 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent"
              />
            </div>

            {/* Descrizione Evento */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-600">Descrizione Evento *</label>
              <textarea
                required
                name="descrizione"
                value={formData.descrizione}
                onChange={handleChange}
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent resize-y"
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
              {ticketToEdit ? 'SALVA MODIFICHE' : 'INSERISCI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
