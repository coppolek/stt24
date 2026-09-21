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

const TABS_KEY = 'fatturazione_tabs';
export const DEFAULT_TABS = [
  'Acqua', 'Lettura contatori', 'Costi di gestione', 'Freddo', 
  'Pertinenze celle-magazzini', 'Pertinenze parcheggi', 'Scarti ittici'
];

export const getFatturazioneTabs = async (): Promise<string[]> => {
  const tabs = await get(TABS_KEY);
  if (tabs && Array.isArray(tabs) && tabs.length > 0) {
    return tabs;
  }
  return DEFAULT_TABS;
};

export const saveFatturazioneTabs = async (tabs: string[]) => {
  await set(TABS_KEY, tabs);
};

export const renameTabAttachment = async (oldTab: string, newTab: string) => {
  const att = await getTabAttachment(oldTab);
  if (att) {
    await saveTabAttachment(newTab, att);
    await removeTabAttachment(oldTab);
  }
};
