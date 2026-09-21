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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    tipoEvento: '',
    dataOra: '',
    risorsa: '',
    descrizione: '',
    note: '',
    titolo: '',
    priorita: 'Bassa'
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
        priorita: ticketToEdit.priorita || 'Bassa'
      });
    } else if (isOpen) {
      setFormData({
        tipoEvento: '',
        dataOra: '',
        risorsa: '',
        descrizione: '',
        note: '',
        titolo: '',
        priorita: 'Bassa'
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
      if (ticketToEdit) {
        const ticketRef = doc(db, 'tickets', ticketToEdit.id);
        await updateDoc(ticketRef, {
          ...formData
        });
        toast.success('Ticket aggiornato!');
      } else {
        await addDoc(collection(db, 'tickets'), {
          ...formData,
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

            {/* Note */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-600">Note</label>
              <textarea
                name="note"
                value={formData.note}
                onChange={handleChange}
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781] focus:border-transparent resize-y"
              />
            </div>
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
