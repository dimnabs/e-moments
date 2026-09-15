import type { DownloadablePhotoStrip, StoredObject } from "../domain/types";

export interface ObjectStorageRepository {
  createDownloadUrl(key: string): Promise<DownloadablePhotoStrip>;
  deletePrivateObjects(keys: string[]): Promise<void>;
  storePrivateObjects(objects: StoredObject[]): Promise<void>;
}
