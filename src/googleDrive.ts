/**
 * Google Drive Integration for Stt24
 * Stores uploaded attachments in a dedicated "Stt24 Allegati" folder in Google Drive.
 */

import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// In-memory access token storage (Mandatory: never store in localStorage/sessionStorage)
let cachedDriveAccessToken: string | null = null;
let cachedDriveUserEmail: string | null = null;
let cachedAppFolderId: string | null = null;
let cachedAppFolderWebViewLink: string | null = null;

// Listeners for UI state reactivity
type DriveStateListener = (state: { isConnected: boolean; email: string | null; folderLink: string | null }) => void;
const listeners = new Set<DriveStateListener>();

function notifyListeners() {
  const state = {
    isConnected: !!cachedDriveAccessToken,
    email: cachedDriveUserEmail,
    folderLink: cachedAppFolderWebViewLink,
  };
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.warn('Listener error in googleDrive:', e);
    }
  });
}

export function subscribeDriveState(fn: DriveStateListener): () => void {
  listeners.add(fn);
  fn({
    isConnected: !!cachedDriveAccessToken,
    email: cachedDriveUserEmail,
    folderLink: cachedAppFolderWebViewLink,
  });
  return () => {
    listeners.delete(fn);
  };
}

// Clear token on sign out
onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedDriveAccessToken = null;
    cachedDriveUserEmail = null;
    cachedAppFolderId = null;
    cachedAppFolderWebViewLink = null;
    notifyListeners();
  }
});

export function isGoogleDriveConnected(): boolean {
  return !!cachedDriveAccessToken;
}

export function getDriveAccessToken(): string | null {
  return cachedDriveAccessToken;
}

export function getDriveUserEmail(): string | null {
  return cachedDriveUserEmail;
}

export function getDriveAppFolderLink(): string | null {
  return cachedAppFolderWebViewLink;
}

/**
 * Initiates Google OAuth Popup with drive.file scope
 */
export async function connectGoogleDrive(): Promise<{ success: boolean; email: string | null; cancelled?: boolean; error?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Impossibile ottenere il token di accesso OAuth per Google Drive.');
    }

    cachedDriveAccessToken = credential.accessToken;
    cachedDriveUserEmail = result.user.email || 'Account Google';

    // Pre-fetch / create the dedicated folder
    try {
      const folder = await getOrCreateAppFolder();
      cachedAppFolderId = folder.id;
      cachedAppFolderWebViewLink = folder.webViewLink || null;
    } catch (err) {
      console.warn('Inizializzazione cartella Google Drive completata con avviso:', err);
    }

    notifyListeners();
    return { success: true, email: cachedDriveUserEmail, cancelled: false };
  } catch (error: any) {
    const isCancelled =
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      String(error?.message).includes('popup-closed-by-user');

    if (isCancelled) {
      console.log('Accesso Google Drive annullato (finestra popup chiusa).');
      return {
        success: false,
        email: null,
        cancelled: true,
        error: 'Finestra di accesso chiusa.',
      };
    }

    console.warn('Avviso collegamento Google Drive:', error?.message || error);
    return {
      success: false,
      email: null,
      cancelled: false,
      error: error?.message || 'Connessione a Google Drive annullata o non riuscita.',
    };
  }
}

/**
 * Disconnects Google Drive token from memory
 */
export function disconnectGoogleDrive() {
  cachedDriveAccessToken = null;
  cachedDriveUserEmail = null;
  cachedAppFolderId = null;
  cachedAppFolderWebViewLink = null;
  notifyListeners();
}

/**
 * Switches the Google Drive account: clears existing tokens and prompts user to select or sign in with another Google account
 */
export async function switchGoogleDriveAccount(): Promise<{ success: boolean; email: string | null; cancelled?: boolean; error?: string }> {
  disconnectGoogleDrive();
  return connectGoogleDrive();
}

/**
 * Ensures the dedicated "Stt24 Allegati" folder exists in Google Drive
 */
export async function getOrCreateAppFolder(folderName = 'Stt24 Allegati'): Promise<{ id: string; name: string; webViewLink?: string }> {
  if (cachedAppFolderId) {
    return { id: cachedAppFolderId, name: folderName, webViewLink: cachedAppFolderWebViewLink || undefined };
  }

  const token = cachedDriveAccessToken;
  if (!token) {
    throw new Error('Google Drive non collegato.');
  }

  // 1. Search for existing folder
  const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    if (searchRes.status === 401) {
      disconnectGoogleDrive();
      throw new Error('Sessione Google Drive scaduta. Riconnetti Google Drive.');
    }
    const errText = await searchRes.text();
    throw new Error(`Errore ricerca cartella Google Drive: ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const existing = searchData.files[0];
    cachedAppFolderId = existing.id;
    cachedAppFolderWebViewLink = existing.webViewLink || null;
    return existing;
  }

  // 2. Create new folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Cartella per gli allegati e documenti dell\'applicazione Stt24',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Errore creazione cartella Google Drive: ${errText}`);
  }

  const createdFolder = await createRes.json();
  cachedAppFolderId = createdFolder.id;
  cachedAppFolderWebViewLink = createdFolder.webViewLink || null;
  return createdFolder;
}

export interface DriveUploadResult {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
  folderId: string;
}

/**
 * Uploads a file directly to Google Drive in the "Stt24 Allegati" folder
 */
export async function uploadFileToGoogleDrive(
  file: File,
  customName?: string,
  folderId?: string
): Promise<DriveUploadResult> {
  const token = cachedDriveAccessToken;
  if (!token) {
    throw new Error('Google Drive non collegato. Connettiti prima a Google Drive.');
  }

  let targetFolderId = folderId || cachedAppFolderId;
  if (!targetFolderId) {
    const folder = await getOrCreateAppFolder();
    targetFolderId = folder.id;
  }

  const fileName = customName?.trim() || file.name;
  const mimeType = file.type || 'application/octet-stream';

  const metadata = {
    name: fileName,
    parents: [targetFolderId],
    description: `Allegato caricato dall'app Stt24 il ${new Date().toLocaleString('it-IT')}`,
  };

  const boundary = '-------stt24_gdrive_upload_' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const fileBuffer = await file.arrayBuffer();

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const mediaPartHeader = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

  const enc = new TextEncoder();
  const metadataBytes = enc.encode(metadataPart);
  const mediaHeaderBytes = enc.encode(mediaPartHeader);
  const closeBytes = enc.encode(closeDelimiter);

  // Combine into single Uint8Array
  const combinedLength = metadataBytes.length + mediaHeaderBytes.length + fileBuffer.byteLength + closeBytes.length;
  const combined = new Uint8Array(combinedLength);

  let offset = 0;
  combined.set(metadataBytes, offset);
  offset += metadataBytes.length;
  combined.set(mediaHeaderBytes, offset);
  offset += mediaHeaderBytes.length;
  combined.set(new Uint8Array(fileBuffer), offset);
  offset += fileBuffer.byteLength;
  combined.set(closeBytes, offset);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: combined,
    }
  );

  if (!uploadRes.ok) {
    if (uploadRes.status === 401) {
      disconnectGoogleDrive();
      throw new Error('Sessione Google Drive scaduta. Riconnetti Google Drive.');
    }
    const errText = await uploadRes.text();
    throw new Error(`Errore caricamento su Google Drive: ${errText}`);
  }

  const data = await uploadRes.json();

  return {
    fileId: data.id,
    name: data.name || fileName,
    mimeType: data.mimeType || mimeType,
    size: Number(data.size) || file.size,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    webContentLink: data.webContentLink,
    thumbnailLink: data.thumbnailLink,
    folderId: targetFolderId,
  };
}

/**
 * Deletes a file from Google Drive with mandatory explicit confirmation
 */
export async function deleteFileFromGoogleDrive(fileId: string, fileName = 'questo file'): Promise<boolean> {
  const token = cachedDriveAccessToken;
  if (!token) {
    throw new Error('Google Drive non collegato.');
  }

  // MANDATORY: User confirmation for destructive operations
  const confirmed = window.confirm(
    `Sei sicuro di voler eliminare definitivamente da Google Drive "${fileName}"?\nQuesta operazione non può essere annullata.`
  );
  if (!confirmed) {
    return false;
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Errore eliminazione da Google Drive: ${errText}`);
  }

  return true;
}
