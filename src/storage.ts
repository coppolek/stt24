import { set, get, del } from 'idb-keyval';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  writeBatch 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage, auth } from './firebase';

export interface ArchivedDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  file?: File;
  relatedId: string;
  description: string;
  uploadDate: Date;
  fileUrl?: string;
  storageType?: 'firebase_storage' | 'firestore_inline' | 'firestore_chunked';
  storagePath?: string;
  dataBase64?: string;
  chunkCount?: number;
  uploadedBy?: string;
  createdAt?: number;
}

const ARCHIVE_LOCAL_KEY = 'archivio_documenti';
const CHUNK_CHAR_LIMIT = 400000; // ~400KB characters per Firestore chunk

/**
 * Optimizes/compresses high-resolution images (e.g. photos from smartphone/WhatsApp)
 * before uploading to cloud, keeping file size small and uploads fast.
 */
export async function optimizeImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }
  // If file is already small (under 400KB), keep as-is
  if (file.size <= 400 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 1600;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

// Helper: Convert File to Base64 Data URL
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// Helper: Convert Base64 Data URL to Blob
export function base64ToBlob(base64DataUrl: string): Blob {
  try {
    const parts = base64DataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const byteCharacters = atob(parts[1] || parts[0]);
    const byteArrays: Uint8Array[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: mime });
  } catch (err) {
    console.error('Error converting base64 to blob:', err);
    return new Blob([], { type: 'application/octet-stream' });
  }
}

// Helper: Try uploading file to Firebase Storage with a strict 3500ms timeout
// to prevent hanging if Firebase Storage is inactive or blocked by CORS.
async function tryUploadToFirebaseStorage(path: string, file: File): Promise<string | null> {
  try {
    const uploadPromise = (async () => {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    })();

    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Firebase Storage timeout')), 3500)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    console.warn('Firebase Storage upload not available or timed out, falling back to Cloud Firestore storage:', err);
    return null;
  }
}

// Helper: Delete file from Firebase Storage if present
async function tryDeleteFromFirebaseStorage(path: string) {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (err) {
    // Non-fatal
  }
}

/**
 * Real-time subscription to Cloud Archive documents.
 * Emits updated list whenever changes happen in Firestore.
 */
export function subscribeToArchive(
  onUpdate: (docs: ArchivedDocument[]) => void,
  onError?: (err: any) => void
) {
  const archiveCol = collection(db, 'archived_documents');
  const q = query(archiveCol, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    async (snapshot) => {
      const docs: ArchivedDocument[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        let fileUrl = data.fileUrl || '';

        // If stored as inline base64 in Cloud Firestore and no URL yet, generate blob URL
        if (!fileUrl && data.storageType === 'firestore_inline' && data.dataBase64) {
          const blob = base64ToBlob(data.dataBase64);
          fileUrl = URL.createObjectURL(blob);
        }

        docs.push({
          id: d.id,
          fileName: data.fileName || 'documento',
          fileType: data.fileType || 'application/octet-stream',
          fileSize: data.fileSize || 0,
          relatedId: data.relatedId || '',
          description: data.description || '',
          uploadDate: data.createdAt ? new Date(data.createdAt) : new Date(),
          fileUrl,
          storageType: data.storageType || 'firestore_inline',
          storagePath: data.storagePath || '',
          dataBase64: data.dataBase64,
          chunkCount: data.chunkCount || 0,
          uploadedBy: data.uploadedBy || '',
          createdAt: data.createdAt || Date.now()
        });
      }
      onUpdate(docs);
    },
    (error) => {
      console.error('Error listening to cloud archive:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Loads or reconstitutes the file URL (for chunked cloud documents if needed).
 */
export async function getDocumentFileUrl(docItem: ArchivedDocument): Promise<string> {
  if (docItem.fileUrl) {
    return docItem.fileUrl;
  }

  if (docItem.storageType === 'firestore_inline' && docItem.dataBase64) {
    const blob = base64ToBlob(docItem.dataBase64);
    return URL.createObjectURL(blob);
  }

  if (docItem.storageType === 'firestore_chunked' && docItem.chunkCount) {
    try {
      const chunksSnap = await getDocs(collection(db, 'archived_documents', docItem.id, 'chunks'));
      const sortedChunks = chunksSnap.docs
        .map(d => d.data() as { chunkIndex: number; data: string })
        .sort((a, b) => a.chunkIndex - b.chunkIndex);

      const combinedBase64 = sortedChunks.map(c => c.data).join('');
      const blob = base64ToBlob(combinedBase64);
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('Error fetching chunks for cloud document:', err);
    }
  }

  return '';
}

/**
 * Download or open a cloud document.
 */
export async function downloadCloudDocument(docItem: ArchivedDocument) {
  const url = await getDocumentFileUrl(docItem);
  if (!url) {
    alert('Impossibile recuperare il file dal cloud.');
    return;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = docItem.relatedId || docItem.fileName;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Gets all archive documents from Cloud Firestore.
 */
export const getArchive = async (): Promise<ArchivedDocument[]> => {
  try {
    const archiveCol = collection(db, 'archived_documents');
    const q = query(archiveCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const cloudDocs: ArchivedDocument[] = [];
    for (const d of snapshot.docs) {
      const data = d.data();
      let fileUrl = data.fileUrl || '';

      if (!fileUrl && data.storageType === 'firestore_inline' && data.dataBase64) {
        const blob = base64ToBlob(data.dataBase64);
        fileUrl = URL.createObjectURL(blob);
      }

      cloudDocs.push({
        id: d.id,
        fileName: data.fileName || 'documento',
        fileType: data.fileType || 'application/octet-stream',
        fileSize: data.fileSize || 0,
        relatedId: data.relatedId || '',
        description: data.description || '',
        uploadDate: data.createdAt ? new Date(data.createdAt) : new Date(),
        fileUrl,
        storageType: data.storageType || 'firestore_inline',
        storagePath: data.storagePath || '',
        dataBase64: data.dataBase64,
        chunkCount: data.chunkCount || 0,
        uploadedBy: data.uploadedBy || '',
        createdAt: data.createdAt || Date.now()
      });
    }

    return cloudDocs;
  } catch (error) {
    console.error('Error fetching archive from cloud:', error);
    const local = await get(ARCHIVE_LOCAL_KEY);
    return local || [];
  }
};

/**
 * Saves a document to Cloud (Firebase Storage or Cloud Firestore).
 */
export const saveToArchive = async (docData: ArchivedDocument, providedFile?: File) => {
  let fileToSave = providedFile || docData.file;
  if (fileToSave) {
    fileToSave = await optimizeImageIfNeeded(fileToSave);
  }

  const docId = docData.id || Math.random().toString(36).substr(2, 9);
  const now = Date.now();
  const userEmail = auth.currentUser?.email || 'anon';

  let storageType: 'firebase_storage' | 'firestore_inline' | 'firestore_chunked' = 'firestore_inline';
  let storagePath = '';
  let cloudFileUrl = '';
  let dataBase64 = '';
  let chunkCount = 0;

  if (fileToSave) {
    // 1. First attempt: upload to Firebase Storage (with 3.5s timeout)
    const cleanFileName = fileToSave.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    storagePath = `archivio/${docId}_${cleanFileName}`;
    const storageUrl = await tryUploadToFirebaseStorage(storagePath, fileToSave);

    if (storageUrl) {
      storageType = 'firebase_storage';
      cloudFileUrl = storageUrl;
    } else {
      // 2. Second attempt / Cloud Firestore persistence: encode as Base64
      storagePath = '';
      dataBase64 = await fileToBase64(fileToSave);

      if (dataBase64.length <= 750000) {
        storageType = 'firestore_inline';
      } else {
        // Chunk the file across subcollection documents
        storageType = 'firestore_chunked';
        const chunks: string[] = [];
        for (let i = 0; i < dataBase64.length; i += CHUNK_CHAR_LIMIT) {
          chunks.push(dataBase64.substring(i, i + CHUNK_CHAR_LIMIT));
        }
        chunkCount = chunks.length;

        // Save chunks to subcollection
        const batch = writeBatch(db);
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunkRef = doc(db, 'archived_documents', docId, 'chunks', String(idx));
          batch.set(chunkRef, { chunkIndex: idx, data: chunks[idx] });
        }
        await batch.commit();
        // Clear dataBase64 from top document to avoid 1MB limit
        dataBase64 = '';
      }
    }
  }

  // Save metadata to Cloud Firestore
  const firestoreDocRef = doc(db, 'archived_documents', docId);
  const payload: any = {
    id: docId,
    fileName: docData.fileName || fileToSave?.name || 'documento',
    fileType: docData.fileType || fileToSave?.type || 'application/octet-stream',
    fileSize: fileToSave?.size || docData.fileSize || 0,
    relatedId: docData.relatedId || '',
    description: docData.description || '',
    storageType,
    storagePath,
    fileUrl: cloudFileUrl,
    chunkCount,
    uploadedBy: userEmail,
    uploadDate: new Date(now).toISOString(),
    createdAt: now
  };

  if (storageType === 'firestore_inline' && dataBase64) {
    payload.dataBase64 = dataBase64;
  }

  await setDoc(firestoreDocRef, payload);

  // Also update local cache
  try {
    const local = await get(ARCHIVE_LOCAL_KEY) || [];
    const updated = [
      {
        ...docData,
        id: docId,
        fileUrl: cloudFileUrl || (fileToSave ? URL.createObjectURL(fileToSave) : '')
      },
      ...local.filter((d: any) => d.id !== docId)
    ];
    await set(ARCHIVE_LOCAL_KEY, updated);
  } catch (e) {
    // Non-fatal
  }
};

/**
 * Removes a document from Cloud Firestore and Firebase Storage.
 */
export const removeFromArchive = async (id: string) => {
  try {
    const docRef = doc(db, 'archived_documents', id);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data.storagePath) {
        await tryDeleteFromFirebaseStorage(data.storagePath);
      }

      if (data.storageType === 'firestore_chunked') {
        const chunksSnap = await getDocs(collection(db, 'archived_documents', id, 'chunks'));
        const batch = writeBatch(db);
        chunksSnap.docs.forEach(c => batch.delete(c.ref));
        await batch.commit();
      }

      await deleteDoc(docRef);
    }
  } catch (err) {
    console.error('Error deleting document from cloud:', err);
  }

  // Remove from local cache
  try {
    const local = await get(ARCHIVE_LOCAL_KEY);
    if (Array.isArray(local)) {
      const updated = local.filter((d: any) => d.id !== id);
      await set(ARCHIVE_LOCAL_KEY, updated);
    }
  } catch (e) {
    // Non-fatal
  }
};

// ---------------------------------------------------------------------------
// Cloud Tab Attachments (Fatturazione)
// ---------------------------------------------------------------------------

export interface CloudTabAttachment {
  name: string;
  type: string;
  size?: number;
  file?: File;
  url?: string;
  fileUrl?: string;
  storagePath?: string;
  storageType?: string;
  dataBase64?: string;
  chunkCount?: number;
  updatedAt?: number;
}

export const getTabAttachment = async (tab: string): Promise<CloudTabAttachment | null> => {
  try {
    const safeTabKey = encodeURIComponent(tab);
    const docRef = doc(db, 'fatturazione_attachments', safeTabKey);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      let url = data.fileUrl || '';

      if (!url && data.storageType === 'firestore_inline' && data.dataBase64) {
        const blob = base64ToBlob(data.dataBase64);
        url = URL.createObjectURL(blob);
      } else if (!url && data.storageType === 'firestore_chunked' && data.chunkCount) {
        try {
          const chunksSnap = await getDocs(collection(db, 'fatturazione_attachments', safeTabKey, 'chunks'));
          const sortedChunks = chunksSnap.docs
            .map(d => d.data() as { chunkIndex: number; data: string })
            .sort((a, b) => a.chunkIndex - b.chunkIndex);

          const combinedBase64 = sortedChunks.map(c => c.data).join('');
          const blob = base64ToBlob(combinedBase64);
          url = URL.createObjectURL(blob);
        } catch (chunkErr) {
          console.error('Error loading tab attachment chunks from cloud:', chunkErr);
        }
      }

      return {
        name: data.name,
        type: data.type,
        size: data.size,
        url,
        fileUrl: data.fileUrl,
        storagePath: data.storagePath,
        storageType: data.storageType,
        dataBase64: data.dataBase64,
        chunkCount: data.chunkCount
      };
    }
  } catch (err) {
    console.warn('Error fetching tab attachment from cloud, checking local:', err);
  }

  // Fallback to local
  return await get(`fatturazione_attachment_${tab}`);
};

export const saveTabAttachment = async (
  tab: string, 
  attachment: { name: string; type: string; file: File }
) => {
  const safeTabKey = encodeURIComponent(tab);
  const now = Date.now();
  
  // Optimize image if it's an image file
  const fileToSave = await optimizeImageIfNeeded(attachment.file);

  let storageType = 'firestore_inline';
  let storagePath = `fatturazione/${safeTabKey}_${attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  let cloudFileUrl = '';
  let dataBase64 = '';
  let chunkCount = 0;

  // Try Firebase Storage first with 3.5s timeout
  const storageUrl = await tryUploadToFirebaseStorage(storagePath, fileToSave);
  if (storageUrl) {
    storageType = 'firebase_storage';
    cloudFileUrl = storageUrl;
  } else {
    storagePath = '';
    dataBase64 = await fileToBase64(fileToSave);

    if (dataBase64.length <= 750000) {
      storageType = 'firestore_inline';
    } else {
      // Chunking for large files to avoid Firestore 1MB document limit
      storageType = 'firestore_chunked';
      const chunks: string[] = [];
      for (let i = 0; i < dataBase64.length; i += CHUNK_CHAR_LIMIT) {
        chunks.push(dataBase64.substring(i, i + CHUNK_CHAR_LIMIT));
      }
      chunkCount = chunks.length;

      const batch = writeBatch(db);
      for (let idx = 0; idx < chunks.length; idx++) {
        const chunkRef = doc(db, 'fatturazione_attachments', safeTabKey, 'chunks', String(idx));
        batch.set(chunkRef, { chunkIndex: idx, data: chunks[idx] });
      }
      await batch.commit();
      dataBase64 = '';
    }
  }

  // Save to Cloud Firestore
  const docRef = doc(db, 'fatturazione_attachments', safeTabKey);
  await setDoc(docRef, {
    tabName: tab,
    name: attachment.name,
    type: attachment.type,
    size: fileToSave.size,
    fileUrl: cloudFileUrl,
    storagePath,
    storageType,
    chunkCount,
    dataBase64: storageType === 'firestore_inline' ? dataBase64 : '',
    updatedAt: now
  });

  // Local backup
  await set(`fatturazione_attachment_${tab}`, {
    name: attachment.name,
    type: attachment.type,
    file: fileToSave
  });
};

export const removeTabAttachment = async (tab: string) => {
  const safeTabKey = encodeURIComponent(tab);
  try {
    const docRef = doc(db, 'fatturazione_attachments', safeTabKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.storagePath) {
        await tryDeleteFromFirebaseStorage(data.storagePath);
      }
      if (data.storageType === 'firestore_chunked') {
        const chunksSnap = await getDocs(collection(db, 'fatturazione_attachments', safeTabKey, 'chunks'));
        const batch = writeBatch(db);
        chunksSnap.docs.forEach(c => batch.delete(c.ref));
        await batch.commit();
      }
      await deleteDoc(docRef);
    }
  } catch (err) {
    console.error('Error removing tab attachment from cloud:', err);
  }

  await del(`fatturazione_attachment_${tab}`);
};

export const renameTabAttachment = async (oldTab: string, newTab: string) => {
  const att = await getTabAttachment(oldTab);
  if (att) {
    const safeOldKey = encodeURIComponent(oldTab);
    const safeNewKey = encodeURIComponent(newTab);

    try {
      const oldDocRef = doc(db, 'fatturazione_attachments', safeOldKey);
      const oldSnap = await getDoc(oldDocRef);
      if (oldSnap.exists()) {
        const data = oldSnap.data();
        await setDoc(doc(db, 'fatturazione_attachments', safeNewKey), {
          ...data,
          tabName: newTab,
          updatedAt: Date.now()
        });
        await deleteDoc(oldDocRef);
      }
    } catch (e) {
      console.error('Error renaming tab attachment in cloud:', e);
    }

    await set(`fatturazione_attachment_${newTab}`, att);
    await del(`fatturazione_attachment_${oldTab}`);
  }
};

// ---------------------------------------------------------------------------
// Cloud Fatturazione Tabs
// ---------------------------------------------------------------------------

const TABS_KEY = 'fatturazione_tabs';
export const DEFAULT_TABS = [
  'Acqua', 'Lettura contatori', 'Costi di gestione', 'Freddo', 
  'Pertinenze celle-magazzini', 'Pertinenze parcheggi', 'Scarti ittici'
];

export const getFatturazioneTabs = async (): Promise<string[]> => {
  try {
    const docRef = doc(db, 'fatturazione_config', 'tabs');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.tabs) {
        const parsed = JSON.parse(data.tabs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Error reading tabs from cloud, fallback to local:', err);
  }

  const tabs = await get(TABS_KEY);
  if (tabs && Array.isArray(tabs) && tabs.length > 0) {
    return tabs;
  }
  return DEFAULT_TABS;
};

export const saveFatturazioneTabs = async (tabs: string[]) => {
  try {
    const docRef = doc(db, 'fatturazione_config', 'tabs');
    await setDoc(docRef, {
      tabs: JSON.stringify(tabs),
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error('Error saving tabs to cloud:', err);
  }
  await set(TABS_KEY, tabs);
};
