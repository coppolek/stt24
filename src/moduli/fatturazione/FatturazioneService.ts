export interface ParametriGlobali {
  [chiave: string]: number;
}

export interface DatiFatturaTrimestrale {
  codiceFiscale: string;
  trimestre: number;
  totaleAcqua: number;
  canonePertinenze: number;
  costiGestione: number;
  speseFreddo: number;
  scartiIttici: number;
  totaleFattura: number;
}

export class FatturazioneService {
  /**
   * Calcola il consumo totale dell'acqua.
   * @param consumi - Consumi banchi
   * @param rubinetti - Quota rubinetti comuni
   * @returns Il totale del consumo (gestendo eventuali valori null/undefined)
   */
  public static calcolaAcqua(consumi: number | null | undefined, rubinetti: number | null | undefined): number {
    const c = consumi ?? 0;
    const r = rubinetti ?? 0;
    return c + r;
  }

  /**
   * Calcola i canoni annui e trimestrali in base ai metri quadri e alla tariffa applicata.
   * @param mq - Metri quadri della pertinenza
   * @param tariffa - Tariffa applicata
   * @returns Oggetto contenente canone annuo e trimestrale
   */
  public static calcolaCanoni(mq: number, tariffa: number): { canoneAnnuo: number; canoneTrimestrale: number } {
    const m = mq ?? 0;
    const t = tariffa ?? 0;
    const canoneAnnuo = m * t;
    const canoneTrimestrale = canoneAnnuo / 4;
    return {
      canoneAnnuo: Number(canoneAnnuo.toFixed(2)),
      canoneTrimestrale: Number(canoneTrimestrale.toFixed(2))
    };
  }

  /**
   * Calcola i costi di gestione.
   * La logica applicata moltiplica i millesimi per il costo base e applica un coefficiente sui mq,
   * in base a come il sistema di ripartizione spese richiede.
   * @param millesimi - Millesimi di pertinenza
   * @param mq - Metri quadri
   * @param parametriGlobali - Mappa dei parametri globali del database
   */
  public static calcolaCostiGestione(millesimi: number, mq: number, parametriGlobali: ParametriGlobali): number {
    const costoBase = parametriGlobali['COSTO_BASE_GESTIONE'] ?? 0;
    const moltiplicatoreMq = parametriGlobali['MOLTIPLICATORE_MQ'] ?? 1;
    
    const costo = (millesimi * costoBase) + (mq * moltiplicatoreMq);
    return Number(costo.toFixed(2));
  }

  /**
   * Genera il riepilogo trimestrale aggregato per una specifica ditta.
   * @param codiceFiscale - Codice fiscale della ditta
   * @param trimestre - Trimestre di riferimento
   * @param dataSource - Dipendenza iniettata contenente le query al database
   */
  public static async generaRiepilogoTrimestrale(
    codiceFiscale: string, 
    trimestre: number, 
    dataSource: any // Astratto per mantenere il modulo isolato e puro
  ): Promise<DatiFatturaTrimestrale> {
    
    // Esempio di utilizzo del dataSource (simulato per rispettare l'isolamento)
    // const ditta = await dataSource.getDittaByCF(codiceFiscale);
    // const acqua = await dataSource.getConsumiAcqua(ditta.id, trimestre);
    // const pertinenze = await dataSource.getPertinenze(ditta.id);
    // ...
    
    // Mock dei dati ricavati per calcolare la fattura finale (Sostituire con chiamate reali nel dataSource)
    const totaleAcqua = this.calcolaAcqua(150.50, 45.20); 
    const canoni = this.calcolaCanoni(50, 12.5); // mq = 50, tariffa = 12.5
    
    const paramsMock: ParametriGlobali = { 'COSTO_BASE_GESTIONE': 1000, 'MOLTIPLICATORE_MQ': 1.5 };
    const costiGest = this.calcolaCostiGestione(15, 50, paramsMock);
    
    const speseFreddo = 320.00; // Valore ipotetico da DB
    const scartiIttici = 85.00; // Valore ipotetico da DB

    const totaleFattura = totaleAcqua + canoni.canoneTrimestrale + costiGest + speseFreddo + scartiIttici;

    return {
      codiceFiscale,
      trimestre,
      totaleAcqua,
      canonePertinenze: canoni.canoneTrimestrale,
      costiGestione: costiGest,
      speseFreddo,
      scartiIttici,
      totaleFattura: Number(totaleFattura.toFixed(2))
    };
  }
}
