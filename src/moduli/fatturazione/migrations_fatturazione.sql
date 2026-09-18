-- SCRIPT DATABASE (PostgreSQL / MySQL compatibility)

CREATE TABLE Ditte_Fatturazione (
    ID SERIAL PRIMARY KEY,
    Ragione_Sociale VARCHAR(255) NOT NULL,
    Codice_Fiscale VARCHAR(16) UNIQUE NOT NULL,
    Settore VARCHAR(100),
    Posteggio_Principale VARCHAR(50)
);

CREATE TABLE Consumi_Acqua (
    ID SERIAL PRIMARY KEY,
    Ditta_ID INT REFERENCES Ditte_Fatturazione(ID) ON DELETE CASCADE,
    Trimestre INT CHECK (Trimestre BETWEEN 1 AND 4),
    Anno INT NOT NULL,
    Consumi_Banchi NUMERIC(10, 2) DEFAULT 0,
    Rubinetti_Comuni NUMERIC(10, 2) DEFAULT 0,
    UNIQUE(Ditta_ID, Trimestre, Anno)
);

CREATE TABLE Letture_Contatori (
    ID SERIAL PRIMARY KEY,
    Ditta_ID INT REFERENCES Ditte_Fatturazione(ID) ON DELETE CASCADE,
    Trimestre INT CHECK (Trimestre BETWEEN 1 AND 4),
    Anno INT NOT NULL,
    Cella_Posteggio VARCHAR(50),
    Importo NUMERIC(10, 2) DEFAULT 0
);

CREATE TABLE Costi_Gestione (
    ID SERIAL PRIMARY KEY,
    Ditta_ID INT REFERENCES Ditte_Fatturazione(ID) ON DELETE CASCADE,
    Trimestre INT CHECK (Trimestre BETWEEN 1 AND 4),
    Anno INT NOT NULL,
    Mq_Reparto NUMERIC(10, 2) DEFAULT 0,
    Mq_Totali NUMERIC(10, 2) DEFAULT 0,
    Millesimi NUMERIC(10, 4) DEFAULT 0,
    UNIQUE(Ditta_ID, Trimestre, Anno)
);

CREATE TABLE Spese_Freddo (
    ID SERIAL PRIMARY KEY,
    Ditta_ID INT REFERENCES Ditte_Fatturazione(ID) ON DELETE CASCADE,
    Trimestre INT CHECK (Trimestre BETWEEN 1 AND 4),
    Anno INT NOT NULL,
    Importo NUMERIC(10, 2) DEFAULT 0,
    UNIQUE(Ditta_ID, Trimestre, Anno)
);

CREATE TABLE Pertinenze_Celle (
    ID SERIAL PRIMARY KEY,
    Ditta_ID INT REFERENCES Ditte_Fatturazione(ID) ON DELETE CASCADE,
    Tipologia VARCHAR(100),
    Mq NUMERIC(10, 2) DEFAULT 0,
    Tariffa_Applicata NUMERIC(10, 2) DEFAULT 0
);

CREATE TABLE Pertinenze_Parcheggi (
    ID SERIAL PRIMARY KEY,
    Ditta_ID INT REFERENCES Ditte_Fatturazione(ID) ON DELETE CASCADE,
    Area VARCHAR(100),
    Mq NUMERIC(10, 2) DEFAULT 0,
    Tariffa_Applicata NUMERIC(10, 2) DEFAULT 0
);

CREATE TABLE Scarti_Ittici (
    ID SERIAL PRIMARY KEY,
    Ditta_ID INT REFERENCES Ditte_Fatturazione(ID) ON DELETE CASCADE,
    Trimestre INT CHECK (Trimestre BETWEEN 1 AND 4),
    Anno INT NOT NULL,
    Importo NUMERIC(10, 2) DEFAULT 0,
    UNIQUE(Ditta_ID, Trimestre, Anno)
);

CREATE TABLE Parametri_Globali (
    Chiave VARCHAR(100) PRIMARY KEY,
    Valore NUMERIC(10, 4) NOT NULL,
    Descrizione TEXT
);
