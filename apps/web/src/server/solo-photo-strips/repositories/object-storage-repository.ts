import type { DownloadablePhotoStrip, StoredObject } from "../domain/types";

export interface ObjectStorageRepository {
  createDownloadUrl(key: string): Promise<DownloadablePhotoStrip>;
  storePrivateObjects(objects: StoredObject[]): Promise<void>;
}
