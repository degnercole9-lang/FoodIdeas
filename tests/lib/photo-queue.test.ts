import { describe, expect, it } from "vitest";

import {
  addPhotos,
  createPhoto,
  type QueuedPhoto,
  removePhoto,
  restorePhoto,
} from "../../lib/photo-queue";

function fakePhoto(name: string): QueuedPhoto {
  return createPhoto({
    id: `id-${name}`,
    file: new File(["photo"], `${name}.jpg`, { type: "image/jpeg" }),
    source: "library",
  });
}

describe("photo queue helpers", () => {
  it("adds photos up to max limit and returns dropped overflow", () => {
    const queue = [fakePhoto("a"), fakePhoto("b")];
    const incoming = [fakePhoto("c"), fakePhoto("d")];

    const result = addPhotos(queue, incoming, 3);

    expect(result.queue.map((item) => item.id)).toEqual([
      "id-a",
      "id-b",
      "id-c",
    ]);
    expect(result.dropped.map((item) => item.id)).toEqual(["id-d"]);
  });

  it("removes a photo and returns removed item", () => {
    const queue = [fakePhoto("a"), fakePhoto("b"), fakePhoto("c")];

    const result = removePhoto(queue, "id-b");

    expect(result.queue.map((item) => item.id)).toEqual(["id-a", "id-c"]);
    expect(result.removed?.id).toBe("id-b");
  });

  it("restores a removed photo to its original index", () => {
    const queue = [fakePhoto("a"), fakePhoto("c")];
    const removed = fakePhoto("b");

    const result = restorePhoto(queue, removed, 1, 3);

    expect(result.queue.map((item) => item.id)).toEqual([
      "id-a",
      "id-b",
      "id-c",
    ]);
    expect(result.restored).toBe(true);
  });

  it("does not restore when queue is full", () => {
    const queue = [fakePhoto("a"), fakePhoto("b"), fakePhoto("c")];
    const removed = fakePhoto("d");

    const result = restorePhoto(queue, removed, 1, 3);

    expect(result.restored).toBe(false);
    expect(result.queue.map((item) => item.id)).toEqual([
      "id-a",
      "id-b",
      "id-c",
    ]);
  });
});
