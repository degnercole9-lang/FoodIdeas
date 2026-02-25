export type PhotoSource = "camera" | "library";

export type QueuedPhoto = {
  id: string;
  file: File;
  source: PhotoSource;
};

export type AddPhotosResult = {
  queue: QueuedPhoto[];
  dropped: QueuedPhoto[];
};

export type RemovePhotoResult = {
  queue: QueuedPhoto[];
  removed?: QueuedPhoto;
  removedIndex: number;
};

export type RestorePhotoResult = {
  queue: QueuedPhoto[];
  restored: boolean;
};

export function createPhoto(photo: QueuedPhoto): QueuedPhoto {
  return photo;
}

export function addPhotos(
  currentQueue: QueuedPhoto[],
  incomingPhotos: QueuedPhoto[],
  maxPhotos: number,
): AddPhotosResult {
  const combined = [...currentQueue, ...incomingPhotos];
  return {
    queue: combined.slice(0, maxPhotos),
    dropped: combined.slice(maxPhotos),
  };
}

export function removePhoto(
  currentQueue: QueuedPhoto[],
  photoId: string,
): RemovePhotoResult {
  const removedIndex = currentQueue.findIndex((photo) => photo.id === photoId);
  if (removedIndex === -1) {
    return { queue: currentQueue, removed: undefined, removedIndex: -1 };
  }

  const queue = currentQueue.filter((photo) => photo.id !== photoId);
  return { queue, removed: currentQueue[removedIndex], removedIndex };
}

export function restorePhoto(
  currentQueue: QueuedPhoto[],
  removedPhoto: QueuedPhoto,
  originalIndex: number,
  maxPhotos: number,
): RestorePhotoResult {
  if (currentQueue.length >= maxPhotos) {
    return { queue: currentQueue, restored: false };
  }

  const queue = [...currentQueue];
  const insertIndex = Math.max(0, Math.min(originalIndex, queue.length));
  queue.splice(insertIndex, 0, removedPhoto);
  return { queue, restored: true };
}
