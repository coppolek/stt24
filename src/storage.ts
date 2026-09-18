import { set, get, del } from 'idb-keyval';

export interface ArchivedDocument {
  id: string;
  fileName: string;
  fileType: string;
  file: File;
  relatedId: string;
  description: string;
  uploadDate: Date;
}

const ARCHIVE_KEY = 'archivio_documenti';

export const getArchive = async (): Promise<ArchivedDocument[]> => {
  const docs = await get(ARCHIVE_KEY);
  return docs || [];
};

export const saveToArchive = async (doc: ArchivedDocument) => {
  const docs = await getArchive();
  docs.unshift(doc);
  await set(ARCHIVE_KEY, docs);
};

export const removeFromArchive = async (id: string) => {
  const docs = await getArchive();
  const updated = docs.filter(d => d.id !== id);
  await set(ARCHIVE_KEY, updated);
};

export const getTabAttachment = async (tab: string) => {
  return await get(`fatturazione_attachment_${tab}`);
};

export const saveTabAttachment = async (tab: string, attachment: { name: string, type: string, file: File }) => {
  await set(`fatturazione_attachment_${tab}`, attachment);
};

export const removeTabAttachment = async (tab: string) => {
  await del(`fatturazione_attachment_${tab}`);
};
