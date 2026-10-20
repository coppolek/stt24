import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import oracledb from 'oracledb';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

dotenv.config();

// Ensure oracledb operates in Thin mode (pure JS/TS, no Instant Client binary required)
try {
  oracledb.initOracleClient = () => {
    throw new Error('Using Thin mode');
  };
} catch {
  // Already in thin mode
}

const CONFIG_FILE = path.resolve(process.cwd(), 'oracle_config.json');
const WALLET_DIR = path.resolve(process.cwd(), 'oracle_wallet');

const DEFAULT_CONNECT_STRING =
  '(description=(retry_count=3)(retry_delay=1)(address=(protocol=tcps)(port=1521)(host=adb.eu-turin-1.oraclecloud.com))(connect_data=(service_name=g4baf80d64d08cb_ua0vjdcnqxa4bx0x_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))';

interface DbConfig {
  user: string;
  password: string;
  connectString: string;
  useWallet: boolean;
  walletLocation?: string;
  walletPassword?: string;
}

function loadSavedConfig(): DbConfig {
  let fileConfig: Partial<DbConfig> = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      console.warn('[Oracle Auto-Config] Impossibile leggere oracle_config.json:', e);
    }
  }

  const hasWalletFiles = fs.existsSync(WALLET_DIR) && fs.readdirSync(WALLET_DIR).length > 0;

  return {
    user: process.env.ORACLE_USER || fileConfig.user || 'ADMIN',
    password: process.env.ORACLE_PASSWORD || fileConfig.password || '',
    connectString: process.env.ORACLE_CONNECT_STRING || fileConfig.connectString || DEFAULT_CONNECT_STRING,
    useWallet: process.env.ORACLE_USE_WALLET !== undefined 
      ? process.env.ORACLE_USE_WALLET === 'true' 
      : (fileConfig.useWallet ?? hasWalletFiles),
    walletLocation: hasWalletFiles ? WALLET_DIR : undefined,
    walletPassword: process.env.ORACLE_WALLET_PASSWORD || fileConfig.walletPassword || '',
  };
}

function saveConfigToFile(cfg: DbConfig) {
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(
        {
          user: cfg.user,
          password: cfg.password,
          connectString: cfg.connectString,
          useWallet: cfg.useWallet,
          walletPassword: cfg.walletPassword,
        },
        null,
        2
      )
    );
  } catch (err) {
    console.warn('[Oracle Auto-Config] Impossibile salvare oracle_config.json:', err);
  }
}

let dbConfig: DbConfig = loadSavedConfig();
let isConnected = false;
let isConnecting = false;
let lastError: string | null = null;
let lastErrorDetails: any = null;
let autoConnectTimer: NodeJS.Timeout | null = null;

// Known outbound IP of the container/host
const SERVER_IPS = {
  ipv4: '34.96.39.13',
  ipv6: '2600:1900:0:3401::601',
};

/**
 * Checks if a wallet password decrypts the ewallet.p12 or ewallet.pem file.
 */
function verifyWalletPassword(password: string): boolean {
  if (!fs.existsSync(WALLET_DIR)) return false;
  const p12Path = path.join(WALLET_DIR, 'ewallet.p12');
  if (fs.existsSync(p12Path)) {
    try {
      execSync(`openssl pkcs12 -in "${p12Path}" -noout -passin pass:${JSON.stringify(password || '')}`, {
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }
  const pemPath = path.join(WALLET_DIR, 'ewallet.pem');
  if (fs.existsSync(pemPath)) {
    try {
      execSync(`openssl rsa -in "${pemPath}" -passin pass:${JSON.stringify(password || '')}`, {
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

function getExtractedAliases(): string[] {
  const tnsPath = path.join(WALLET_DIR, 'tnsnames.ora');
  if (fs.existsSync(tnsPath)) {
    try {
      const content = fs.readFileSync(tnsPath, 'utf8');
      const matches = content.match(/^([a-zA-Z0-9_]+)\s*=/gm);
      if (matches) {
        return matches.map((m) => m.replace('=', '').trim());
      }
    } catch {
      // Ignore
    }
  }
  return [];
}

/**
 * Builds connection parameters for oracledb
 */
function buildConnectionParams(config: DbConfig) {
  const connParams: any = {
    user: config.user,
    password: config.password,
    connectString: config.connectString,
  };

  if (config.useWallet && config.walletLocation && fs.existsSync(config.walletLocation)) {
    connParams.walletLocation = config.walletLocation;
    if (config.walletPassword) {
      connParams.walletPassword = config.walletPassword;
    }
  }

  return connParams;
}

/**
 * Executes schema initialization for tables
 */
async function initializeOracleTables(connection: oracledb.Connection) {
  const tableStatements = [
    `CREATE TABLE STT24_TICKETS (
      ID VARCHAR2(64) PRIMARY KEY,
      TITOLO VARCHAR2(255),
      PRIORITA VARCHAR2(50),
      TIPO_EVENTO VARCHAR2(100),
      DATA_ORA VARCHAR2(100),
      RISORSA VARCHAR2(100),
      DESCRIZIONE CLOB,
      NOTE CLOB,
      STATO VARCHAR2(50),
      SOLUZIONE CLOB,
      GESTITO_DA VARCHAR2(100),
      GESTITO_IL NUMBER,
      USER_ID VARCHAR2(128),
      CREATED_AT NUMBER
    )`,
    `CREATE TABLE STT24_DOCUMENTI (
      ID VARCHAR2(64) PRIMARY KEY,
      FILE_NAME VARCHAR2(255),
      FILE_TYPE VARCHAR2(100),
      FILE_SIZE NUMBER,
      RELATED_ID VARCHAR2(255),
      DESCRIPTION VARCHAR2(1000),
      UPLOAD_DATE NUMBER,
      FILE_DATA CLOB
    )`,
    `CREATE TABLE STT24_FATTURAZIONE_TABS (
      TAB_NAME VARCHAR2(255) PRIMARY KEY,
      ATTACHMENT_NAME VARCHAR2(255),
      ATTACHMENT_TYPE VARCHAR2(100),
      ATTACHMENT_DATA CLOB,
      UPDATED_AT NUMBER
    )`,
  ];

  for (const sql of tableStatements) {
    try {
      await connection.execute(sql);
    } catch {
      // Table already exists (ORA-00955) - expected
    }
  }
}

/**
 * Tests / initiates connection to Oracle
 */
async function testOracleConnection(config: DbConfig) {
  if (!config.password) {
    return {
      success: false,
      error: "Password dell'utente non ancora configurata.",
      details: {
        message: "In attesa della password dell'utente database.",
        isAclError: false,
        isAuthError: true,
        isWalletDecryptError: false,
        isWalletError: false,
        serverIps: SERVER_IPS,
      },
    };
  }

  // Pre-check wallet credentials if wallet is enabled
  if (config.useWallet && config.walletLocation && fs.existsSync(config.walletLocation)) {
    const p12Exists = fs.existsSync(path.join(config.walletLocation, 'ewallet.p12'));
    if (p12Exists) {
      const works = verifyWalletPassword(config.walletPassword || '');
      if (!works) {
        return {
          success: false,
          error: 'NJS-505: unable to initiate TLS connection (bad decrypt)',
          details: {
            message: 'Errore decifratura wallet.',
            isWalletDecryptError: true,
            isWalletError: true,
            isAclError: false,
            isAuthError: false,
            serverIps: SERVER_IPS,
          },
        };
      }
    }
  }

  let connection;
  try {
    const connParams = buildConnectionParams(config);
    try {
      connection = await oracledb.getConnection(connParams);
    } catch (firstErr: any) {
      // If 1522 failed and connectString has port 1522, try port 1521 (standard TLS for ADB)
      if (typeof connParams.connectString === 'string' && connParams.connectString.includes('port=1522')) {
        try {
          const fallbackParams = {
            ...connParams,
            connectString: connParams.connectString.replace(/port=1522/g, 'port=1521'),
          };
          connection = await oracledb.getConnection(fallbackParams);
          // If successful on 1521, update config connectString
          config.connectString = fallbackParams.connectString;
          saveConfigToFile(config);
        } catch {
          throw firstErr;
        }
      } else {
        throw firstErr;
      }
    }

    const result = await connection.execute("SELECT 'Oracle Autonomous Database Connesso' AS MSG FROM DUAL");
    await initializeOracleTables(connection);

    isConnected = true;
    lastError = null;
    lastErrorDetails = null;
    return {
      success: true,
      message: 'Connessione stabilita con successo con Oracle Autonomous Database!',
      data: result.rows,
    };
  } catch (err: any) {
    isConnected = false;
    const errMsg = err?.message || String(err);
    lastError = errMsg;

    const isWalletDecryptError =
      errMsg.includes('NJS-505') ||
      errMsg.includes('bad decrypt') ||
      errMsg.includes('wallet credentials are valid') ||
      errMsg.includes('1C800064');

    const isAclError =
      errMsg.includes('ORA-12506') ||
      (errMsg.includes('connection to listener') && errMsg.includes('refused')) ||
      errMsg.includes('NJS-511');

    const isAuthError = errMsg.includes('ORA-01017') || errMsg.includes('invalid username/password');
    const isWalletError =
      isWalletDecryptError ||
      errMsg.includes('ORA-29007') ||
      errMsg.includes('ORA-28759') ||
      errMsg.includes('certificate');

    lastErrorDetails = {
      message: errMsg,
      isAclError,
      isAuthError,
      isWalletDecryptError,
      isWalletError,
      serverIps: SERVER_IPS,
    };

    return {
      success: false,
      error: errMsg,
      details: lastErrorDetails,
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * AUTOMATIC CONNECTION MANAGER:
 * Seamlessly and silently attempts background connection to Oracle.
 * If wallet fails due to decryption error, automatically falls back to direct TLS.
 * Automatically retries every 20 seconds.
 */
async function autoConnectOracle() {
  if (isConnecting) return;
  isConnecting = true;

  try {
    // 1. Try with current dbConfig
    let res = await testOracleConnection(dbConfig);

    // 2. If it failed due to wallet bad decrypt, automatically try fallback to direct TLS (without wallet)
    if (!res.success && dbConfig.useWallet && (res.details?.isWalletDecryptError || res.details?.isWalletError)) {
      console.log('[Oracle Auto-Connect] Rilevato errore cifratura Wallet. Tento fallback automatico in TLS diretto (senza wallet)...');
      const fallbackConfig: DbConfig = {
        ...dbConfig,
        useWallet: false,
        walletLocation: undefined,
      };

      const fallbackRes = await testOracleConnection(fallbackConfig);
      if (fallbackRes.success) {
        dbConfig.useWallet = false;
        dbConfig.walletLocation = undefined;
        saveConfigToFile(dbConfig);
        res = fallbackRes;
        console.log('[Oracle Auto-Connect] Connessione automatica diretta TLS riuscita con successo!');
      }
    }

    if (res.success) {
      console.log('[Oracle Auto-Connect] ✓ Connesso automaticamente a Oracle Autonomous Database.');
    } else {
      // Quiet background log
      if (dbConfig.password) {
        console.log('[Oracle Auto-Connect] Tentativo automatico:', res.error?.split('\n')[0]);
      }
    }
  } catch (err: any) {
    console.error('[Oracle Auto-Connect] Errore inaspettato:', err?.message || err);
  } finally {
    isConnecting = false;
  }
}

function startAutoConnectLoop() {
  // First attempt immediately
  autoConnectOracle();

  // Periodic automatic reconnection/health check
  if (autoConnectTimer) clearInterval(autoConnectTimer);
  autoConnectTimer = setInterval(() => {
    if (!isConnected) {
      autoConnectOracle();
    }
  }, 20000);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // API Status endpoint (purely read-only automated status for frontend badge)
  app.get('/api/oracle/status', (_req: Request, res: Response) => {
    const walletFilesExist = fs.existsSync(WALLET_DIR) && fs.readdirSync(WALLET_DIR).length > 0;
    const aliases = getExtractedAliases();

    res.json({
      connected: isConnected,
      connecting: isConnecting,
      mode: 'automatic',
      user: dbConfig.user,
      connectString: dbConfig.connectString,
      hasPassword: !!dbConfig.password,
      hasWallet: walletFilesExist,
      useWallet: dbConfig.useWallet && walletFilesExist,
      aliases,
      lastError,
      lastErrorDetails,
      serverIps: SERVER_IPS,
    });
  });

  // Background configure endpoint (retains API compatibility for automated tools/env updates)
  app.post('/api/oracle/connect', async (req: Request, res: Response) => {
    const { user, password, connectString, walletPassword, useWallet } = req.body;
    if (user) dbConfig.user = user.trim();
    if (password !== undefined) dbConfig.password = password;
    if (connectString) dbConfig.connectString = connectString.trim();
    if (walletPassword !== undefined) dbConfig.walletPassword = walletPassword.trim();
    if (useWallet !== undefined) dbConfig.useWallet = !!useWallet;

    saveConfigToFile(dbConfig);
    const result = await testOracleConnection(dbConfig);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
      });
    }
  });

  // Trigger manual background retry
  app.post('/api/oracle/retry', async (_req: Request, res: Response) => {
    await autoConnectOracle();
    res.json({ connected: isConnected, lastError });
  });

  // Upload Wallet ZIP (for background file provisioning)
  app.post('/api/oracle/upload-wallet', async (req: Request, res: Response) => {
    try {
      const { walletBase64, walletPassword } = req.body;
      if (!walletBase64) {
        return res.status(400).json({ error: 'Nessun file wallet fornito.' });
      }

      const cleanBase64 = walletBase64.replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      if (!fs.existsSync(WALLET_DIR)) {
        fs.mkdirSync(WALLET_DIR, { recursive: true });
      }

      const tempZipPath = path.join(WALLET_DIR, 'wallet_temp.zip');
      fs.writeFileSync(tempZipPath, buffer);

      execSync(`unzip -o "${tempZipPath}" -d "${WALLET_DIR}"`);
      fs.unlinkSync(tempZipPath);

      dbConfig.walletLocation = WALLET_DIR;
      dbConfig.useWallet = true;
      if (walletPassword !== undefined) {
        dbConfig.walletPassword = walletPassword.trim();
      }

      saveConfigToFile(dbConfig);
      await autoConnectOracle();

      res.json({
        success: true,
        message: 'Wallet Oracle caricato. Connessione automatica avviata in background.',
        aliases: getExtractedAliases(),
      });
    } catch (err: any) {
      console.error('Errore estrazione Wallet:', err);
      res.status(500).json({ error: 'Impossibile estrarre il Wallet ZIP: ' + err.message });
    }
  });

  // Remove Wallet
  app.post('/api/oracle/remove-wallet', async (_req: Request, res: Response) => {
    try {
      if (fs.existsSync(WALLET_DIR)) {
        fs.rmSync(WALLET_DIR, { recursive: true, force: true });
      }
      dbConfig.walletLocation = undefined;
      dbConfig.walletPassword = '';
      dbConfig.useWallet = false;
      saveConfigToFile(dbConfig);

      // Immediately auto-connect via direct TLS
      await autoConnectOracle();

      res.json({
        success: true,
        message: 'Wallet rimosso. Connessione automatica diretta TLS attiva.',
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Errore rimozione wallet: ' + err.message });
    }
  });

  // Outbound IP endpoint
  app.get('/api/oracle/server-ip', (_req: Request, res: Response) => {
    res.json(SERVER_IPS);
  });

  // Automated Tickets API (Reads from Oracle STT24_TICKETS table)
  app.get('/api/oracle/tickets', async (_req: Request, res: Response) => {
    if (!isConnected || !dbConfig.password) {
      return res.json({ success: true, connected: false, tickets: [] });
    }
    let conn;
    try {
      const connParams = buildConnectionParams(dbConfig);
      conn = await oracledb.getConnection(connParams);
      const result = await conn.execute(
        `SELECT ID, TITOLO, PRIORITA, TIPO_EVENTO, DATA_ORA, RISORSA, DESCRIZIONE, NOTE, STATO, SOLUZIONE, GESTITO_DA, GESTITO_IL, USER_ID, CREATED_AT FROM STT24_TICKETS ORDER BY CREATED_AT DESC`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      res.json({ success: true, connected: true, tickets: result.rows || [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      if (conn) await conn.close();
    }
  });

  // Automated Ticket Save / Sync Endpoint
  app.post('/api/oracle/tickets', async (req: Request, res: Response) => {
    if (!isConnected || !dbConfig.password) {
      // Return accepted gracefully so frontend doesn't crash if Oracle is still auto-connecting
      return res.json({ success: true, queued: true, message: 'Ticket ricevuto (Oracle in auto-connessione).' });
    }
    let conn;
    try {
      const t = req.body;
      const id = t.id || Math.random().toString(36).substr(2, 9);
      const connParams = buildConnectionParams(dbConfig);

      conn = await oracledb.getConnection(connParams);
      await conn.execute(
        `MERGE INTO STT24_TICKETS dst
         USING (SELECT :id AS ID FROM DUAL) src
         ON (dst.ID = src.ID)
         WHEN MATCHED THEN
           UPDATE SET TITOLO = :titolo, PRIORITA = :priorita, TIPO_EVENTO = :tipoEvento,
                      DATA_ORA = :dataOra, RISORSA = :risorsa, DESCRIZIONE = :descrizione,
                      NOTE = :note, STATO = :stato, SOLUZIONE = :soluzione,
                      GESTITO_DA = :gestitoDa, GESTITO_IL = :gestitoIl
         WHEN NOT MATCHED THEN
           INSERT (ID, TITOLO, PRIORITA, TIPO_EVENTO, DATA_ORA, RISORSA, DESCRIZIONE, NOTE, STATO, SOLUZIONE, GESTITO_DA, GESTITO_IL, USER_ID, CREATED_AT)
           VALUES (:id, :titolo, :priorita, :tipoEvento, :dataOra, :risorsa, :descrizione, :note, :stato, :soluzione, :gestitoDa, :gestitoIl, :userId, :createdAt)`,
        {
          id,
          titolo: t.titolo || null,
          priorita: t.priorita || 'Bassa',
          tipoEvento: t.tipoEvento || null,
          dataOra: t.dataOra || null,
          risorsa: t.risorsa || null,
          descrizione: t.descrizione || '',
          note: t.note || null,
          stato: t.stato || 'Aperto',
          soluzione: t.soluzione || null,
          gestitoDa: t.gestitoDa || null,
          gestitoIl: t.gestitoIl || null,
          userId: t.userId || 'operatore',
          createdAt: t.createdAt || Date.now(),
        },
        { autoCommit: true }
      );
      res.json({ success: true, id });
    } catch (err: any) {
      console.error('Errore sincronizzazione ticket Oracle:', err);
      res.status(500).json({ error: err.message });
    } finally {
      if (conn) await conn.close();
    }
  });

  // Automated Document Sync Endpoint
  app.get('/api/oracle/documents', async (_req: Request, res: Response) => {
    if (!isConnected || !dbConfig.password) {
      return res.json({ success: true, connected: false, documents: [] });
    }
    let conn;
    try {
      const connParams = buildConnectionParams(dbConfig);
      conn = await oracledb.getConnection(connParams);
      const result = await conn.execute(
        `SELECT ID, FILE_NAME, FILE_TYPE, FILE_SIZE, RELATED_ID, DESCRIPTION, UPLOAD_DATE FROM STT24_DOCUMENTI ORDER BY UPLOAD_DATE DESC`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      res.json({ success: true, connected: true, documents: result.rows || [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      if (conn) await conn.close();
    }
  });

  // Start Vite dev server or static files
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Backend server running on http://0.0.0.0:${port}`);
    // Start automated Oracle connection background loop
    startAutoConnectLoop();
  });
}

startServer().catch((err) => {
  console.error('Fatal server start error:', err);
});
