"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  readFavorites,
  removeFavoriteById,
  upsertFavorite,
  writeFavorites,
} from "@/lib/favorites-storage";
import { normalizeImagesForUpload } from "@/lib/image-processing";
import { normalizeIngredient, toKebabCase } from "@/lib/ingredient-utils";
import {
  extractIngredientsResponseSchema,
  generateRecipesResponseSchema,
  type Ingredient,
  type Recipe,
} from "@/lib/meal-models";
import {
  addPhotos,
  createPhoto,
  type PhotoSource,
  type QueuedPhoto,
  removePhoto,
  restorePhoto,
} from "@/lib/photo-queue";

const MAX_PHOTOS = 3;
const UNDO_TIMEOUT_MS = 5000;

const stageOrder = {
  capture: 1,
  ingredients: 2,
  recipes: 3,
} as const;

type Stage = keyof typeof stageOrder;

type UndoState = {
  photo: QueuedPhoto;
  originalIndex: number;
};

type EditableIngredient = {
  id: string;
  name: string;
  quantityText: string;
  unit: string;
};

function PhotoThumbnail({
  photo,
  onDelete,
}: {
  photo: QueuedPhoto;
  onDelete: (photoId: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo.file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo.file]);

  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black/30">
      {previewUrl ? (
        <Image
          src={previewUrl}
          alt={`${photo.source} selection`}
          className="h-full w-full object-cover"
          width={80}
          height={80}
          unoptimized
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-white/5" />
      )}
      <button
        type="button"
        className="absolute right-1 top-1 rounded-full border border-white/20 bg-black/60 px-1.5 py-0.5 text-xs text-white hover:bg-black/80"
        onClick={() => onDelete(photo.id)}
      >
        ✕
      </button>
    </div>
  );
}

function createEditableIngredient(name = ""): EditableIngredient {
  return {
    id: crypto.randomUUID(),
    name,
    quantityText: "",
    unit: "",
  };
}

function toEditableIngredients(
  ingredients: Ingredient[],
): EditableIngredient[] {
  if (ingredients.length === 0) {
    return [createEditableIngredient()];
  }

  return ingredients.map((item) => ({
    id: item.id || crypto.randomUUID(),
    name: item.name,
    quantityText:
      typeof item.quantity === "number" ? String(item.quantity) : "",
    unit: item.unit ?? "",
  }));
}

function toApiIngredients(ingredients: EditableIngredient[]): Ingredient[] {
  return ingredients
    .map((ingredient) => {
      const parsedQuantity = Number.parseFloat(ingredient.quantityText);
      return normalizeIngredient({
        id: ingredient.id || toKebabCase(ingredient.name),
        name: ingredient.name,
        quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : undefined,
        unit: ingredient.unit.trim() || undefined,
      });
    })
    .filter((ingredient) => ingredient.name.trim().length > 0);
}

export function MealCaptureFlow() {
  const [stage, setStage] = useState<Stage>("capture");

  const [photos, setPhotos] = useState<QueuedPhoto[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);

  const [ingredients, setIngredients] = useState<EditableIngredient[]>([
    createEditableIngredient(),
  ]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const [favorites, setFavorites] = useState<Recipe[]>([]);

  const [extractLoading, setExtractLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);

  const [extractError, setExtractError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [warnings, setWarnings] = useState<string[]>([]);

  const undoTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraFallbackInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFavorites(readFavorites());
  }, []);

  useEffect(() => {
    writeFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current);
      }
      stopCameraStream(streamRef, videoRef);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraOpen || !video || !streamRef.current) {
      return;
    }

    video.srcObject = streamRef.current;
    void video.play();
  }, [cameraOpen]);

  const scheduleUndoReset = () => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = window.setTimeout(() => {
      setUndoState(null);
      undoTimerRef.current = null;
    }, UNDO_TIMEOUT_MS);
  };

  const handleIncomingPhotos = (incomingFiles: File[], source: PhotoSource) => {
    if (incomingFiles.length === 0) {
      return;
    }

    const queued = incomingFiles.map((file) =>
      createPhoto({
        id: crypto.randomUUID(),
        file,
        source,
      }),
    );

    setPhotos((current) => addPhotos(current, queued, MAX_PHOTOS).queue);
  };

  const handleLibrarySelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    handleIncomingPhotos(files, "library");
    event.currentTarget.value = "";
  };

  const handleCameraFallbackSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    handleIncomingPhotos(files, "camera");
    event.currentTarget.value = "";
  };

  const openCamera = async () => {
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      cameraFallbackInputRef.current?.click();
      return;
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setCameraOpen(true);
    } catch {
      setCameraError(
        "Camera unavailable. Use Library or iPhone camera upload.",
      );
      cameraFallbackInputRef.current?.click();
    }
  };

  const closeCamera = () => {
    stopCameraStream(streamRef, videoRef);
    setCameraOpen(false);
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          return;
        }
        const cameraFile = new File([blob], `capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        handleIncomingPhotos([cameraFile], "camera");
        closeCamera();
      },
      "image/jpeg",
      0.9,
    );
  };

  const removeQueuedPhoto = (photoId: string) => {
    setPhotos((current) => {
      const result = removePhoto(current, photoId);
      if (result.removed && result.removedIndex >= 0) {
        setUndoState({
          photo: result.removed,
          originalIndex: result.removedIndex,
        });
        scheduleUndoReset();
      }
      return result.queue;
    });
  };

  const undoRemove = () => {
    if (!undoState) {
      return;
    }

    setPhotos((current) => {
      const restored = restorePhoto(
        current,
        undoState.photo,
        undoState.originalIndex,
        MAX_PHOTOS,
      );
      return restored.queue;
    });
    setUndoState(null);
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const analyzeIngredients = async () => {
    if (photos.length === 0) {
      setExtractError("Add at least one photo before analysis.");
      return;
    }

    setExtractLoading(true);
    setExtractError(null);
    setGenerateError(null);
    setWarnings([]);

    try {
      const normalizedFiles = await normalizeImagesForUpload(
        photos.map((photo) => photo.file),
      );
      const formData = new FormData();
      normalizedFiles.forEach((file) => {
        formData.append("images", file);
      });

      const response = await fetch("/api/extract-ingredients", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Ingredient extraction failed.");
      }

      const parsed = extractIngredientsResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Ingredient response validation failed.");
      }

      setWarnings(parsed.data.warnings);
      setIngredients(toEditableIngredients(parsed.data.ingredients));
      setStage("ingredients");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not analyze photos. Enter ingredients manually.";
      setExtractError(message);
    } finally {
      setExtractLoading(false);
    }
  };

  const enterIngredientsManually = () => {
    setIngredients([createEditableIngredient()]);
    setStage("ingredients");
    setExtractError(null);
  };

  const generateRecipes = async () => {
    const payloadIngredients = toApiIngredients(ingredients);
    if (payloadIngredients.length === 0) {
      setGenerateError(
        "Add at least one ingredient before generating recipes.",
      );
      return;
    }

    setGenerateLoading(true);
    setGenerateError(null);
    setWarnings([]);

    try {
      const response = await fetch("/api/generate-recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ingredients: payloadIngredients }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Recipe generation failed.");
      }

      const parsed = generateRecipesResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Recipe response validation failed.");
      }

      setWarnings(parsed.data.warnings);
      setRecipes(parsed.data.recipes);
      setStage("recipes");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate recipes.";
      setGenerateError(message);
    } finally {
      setGenerateLoading(false);
    }
  };

  const updateIngredient = (
    ingredientId: string,
    updates: Partial<EditableIngredient>,
  ) => {
    setIngredients((current) =>
      current.map((item) =>
        item.id === ingredientId ? { ...item, ...updates } : item,
      ),
    );
  };

  const removeIngredient = (ingredientId: string) => {
    setIngredients((current) => {
      const next = current.filter((item) => item.id !== ingredientId);
      return next.length > 0 ? next : [createEditableIngredient()];
    });
  };

  const resetForNewScan = () => {
    setStage("capture");
    setIngredients([createEditableIngredient()]);
    setRecipes([]);
    setWarnings([]);
    setExtractError(null);
    setGenerateError(null);
  };

  const toggleFavorite = (recipe: Recipe) => {
    setFavorites((current) => {
      const exists = current.some((item) => item.id === recipe.id);
      return exists
        ? removeFavoriteById(current, recipe.id)
        : upsertFavorite(current, recipe);
    });
  };

  const hasReachedLimit = photos.length >= MAX_PHOTOS;
  const stageNumber = stageOrder[stage];

  const favoriteIds = useMemo(
    () => new Set(favorites.map((item) => item.id)),
    [favorites],
  );

  return (
    <div className="min-h-screen bg-[#0f1318] text-[#f6f3ea]">
      <div className="mx-auto w-full max-w-md px-5 pb-36 pt-8">
        <header className="mb-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[#f1b24a]">
            FoodIdeas
          </p>
          <h1 className="text-3xl font-semibold leading-tight">
            Snap your fridge. Get recipe ideas fast.
          </h1>
          <p className="text-sm text-white/65">
            Stage {stageNumber}/3 • Capture, refine ingredients, then generate
            recipe options.
          </p>
        </header>

        {stage === "capture" ? (
          <section className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="mb-4 flex items-center justify-between text-xs text-white/65">
                <span>Selected photos</span>
                <span>
                  {photos.length}/{MAX_PHOTOS}
                </span>
              </div>
              {photos.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {photos.map((photo) => (
                    <PhotoThumbnail
                      key={photo.id}
                      photo={photo}
                      onDelete={removeQueuedPhoto}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-8 text-center text-sm text-white/60">
                  No photos yet. Use Take Photo or Library below.
                </div>
              )}
            </div>

            {cameraError ? (
              <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                {cameraError}
              </p>
            ) : null}

            {extractError ? (
              <div className="space-y-2 rounded-xl border border-red-300/30 bg-red-300/10 px-3 py-3 text-sm text-red-100">
                <p>{extractError}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={analyzeIngredients}
                    className="rounded-lg border border-red-100/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-white/10"
                  >
                    Retry Analysis
                  </button>
                  <button
                    type="button"
                    onClick={enterIngredientsManually}
                    className="rounded-lg border border-red-100/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-white/10"
                  >
                    Enter Manually
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={analyzeIngredients}
              disabled={extractLoading}
              className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-white/90 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {extractLoading ? "Analyzing photos..." : "Analyze Ingredients"}
            </button>
          </section>
        ) : null}

        {stage === "ingredients" ? (
          <section className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-1 text-lg font-semibold">Ingredient editor</h2>
              <p className="mb-4 text-sm text-white/60">
                Correct auto-detected ingredients before recipe generation.
              </p>

              <div className="space-y-3">
                {ingredients.map((ingredient) => (
                  <div
                    key={ingredient.id}
                    className="grid grid-cols-[1fr_84px_80px_36px] gap-2"
                  >
                    <input
                      value={ingredient.name}
                      onChange={(event) =>
                        updateIngredient(ingredient.id, {
                          name: event.currentTarget.value,
                        })
                      }
                      placeholder="Ingredient"
                      className="rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm outline-none ring-0 placeholder:text-white/40 focus:border-[#f1b24a]"
                    />
                    <input
                      value={ingredient.quantityText}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateIngredient(ingredient.id, {
                          quantityText: event.currentTarget.value,
                        })
                      }
                      placeholder="Qty"
                      className="rounded-xl border border-white/15 bg-black/25 px-2 py-2 text-sm outline-none ring-0 placeholder:text-white/40 focus:border-[#f1b24a]"
                    />
                    <input
                      value={ingredient.unit}
                      onChange={(event) =>
                        updateIngredient(ingredient.id, {
                          unit: event.currentTarget.value,
                        })
                      }
                      placeholder="Unit"
                      className="rounded-xl border border-white/15 bg-black/25 px-2 py-2 text-sm outline-none ring-0 placeholder:text-white/40 focus:border-[#f1b24a]"
                    />
                    <button
                      type="button"
                      onClick={() => removeIngredient(ingredient.id)}
                      className="rounded-xl border border-white/20 bg-black/40 text-xs font-semibold text-white/80 hover:bg-black/60"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setIngredients((current) => [
                    ...current,
                    createEditableIngredient(),
                  ])
                }
                className="mt-4 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-white/10"
              >
                Add ingredient
              </button>
            </div>

            {generateError ? (
              <div className="space-y-2 rounded-xl border border-red-300/30 bg-red-300/10 px-3 py-3 text-sm text-red-100">
                <p>{generateError}</p>
                <button
                  type="button"
                  onClick={generateRecipes}
                  className="rounded-lg border border-red-100/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-white/10"
                >
                  Retry Generation
                </button>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStage("capture")}
                className="rounded-xl border border-white/20 px-3 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                Back to photos
              </button>
              <button
                type="button"
                onClick={generateRecipes}
                disabled={generateLoading}
                className="rounded-xl bg-[#f1b24a] px-3 py-3 text-sm font-semibold text-[#201608] hover:bg-[#f7c36b] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generateLoading ? "Generating..." : "Generate recipes"}
              </button>
            </div>
          </section>
        ) : null}

        {stage === "recipes" ? (
          <section className="space-y-4">
            <div className="grid gap-3">
              {recipes.map((recipe) => {
                const isFavorite = favoriteIds.has(recipe.id);
                return (
                  <article
                    key={recipe.id}
                    className="rounded-2xl border border-white/12 bg-white/5 p-4"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {recipe.title}
                        </h3>
                        <p className="mt-1 text-sm text-white/65">
                          {recipe.summary}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(recipe)}
                        className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-white/10"
                      >
                        {isFavorite ? "Saved" : "Save"}
                      </button>
                    </div>

                    <div className="mb-3 flex gap-3 text-xs text-white/65">
                      {recipe.totalMinutes ? (
                        <span>{recipe.totalMinutes} min</span>
                      ) : null}
                      {recipe.servings ? (
                        <span>{recipe.servings} servings</span>
                      ) : null}
                    </div>

                    <details className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-white/90">
                        View ingredients + steps
                      </summary>
                      <div className="mt-3 space-y-2 text-sm text-white/80">
                        <p className="font-medium text-white/95">Ingredients</p>
                        <ul className="list-disc space-y-1 pl-5">
                          {recipe.ingredients.map((item) => (
                            <li key={`${recipe.id}-ingredient-${item}`}>
                              {item}
                            </li>
                          ))}
                        </ul>
                        <p className="pt-1 font-medium text-white/95">Steps</p>
                        <ol className="list-decimal space-y-1 pl-5">
                          {recipe.steps.map((step) => (
                            <li key={`${recipe.id}-step-${step}`}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStage("ingredients")}
                className="rounded-xl border border-white/20 px-3 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                Edit ingredients
              </button>
              <button
                type="button"
                onClick={resetForNewScan}
                className="rounded-xl bg-[#f1b24a] px-3 py-3 text-sm font-semibold text-[#201608] hover:bg-[#f7c36b]"
              >
                New scan
              </button>
            </div>
          </section>
        ) : null}

        {warnings.length > 0 ? (
          <section className="mt-5 rounded-2xl border border-amber-200/25 bg-amber-200/10 p-3 text-sm text-amber-100">
            <p className="mb-2 font-semibold">Notes</p>
            <ul className="list-disc space-y-1 pl-5">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Saved favorites</h2>
            <span className="text-xs text-white/60">{favorites.length}</span>
          </div>
          {favorites.length === 0 ? (
            <p className="text-sm text-white/60">
              Save recipes to keep them across refreshes.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {favorites.map((favorite) => (
                <li
                  key={favorite.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                >
                  <span>{favorite.title}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFavorites((current) =>
                        removeFavoriteById(current, favorite.id),
                      )
                    }
                    className="rounded-lg border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {stage === "capture" ? (
        <div className="fixed inset-x-0 bottom-0 pb-6">
          <div className="mx-auto flex w-[92%] max-w-md items-center justify-between rounded-full border border-white/15 bg-[#12161d]/90 px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
            <span className="text-xs font-medium text-white/60">
              Photos {photos.length}/{MAX_PHOTOS}
            </span>
            <button
              type="button"
              disabled={hasReachedLimit || extractLoading}
              onClick={openCamera}
              className="rounded-full bg-[#f1b24a] px-6 py-3 text-sm font-semibold text-[#22190b] transition hover:bg-[#f7c36b] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Take Photo
            </button>
            <button
              type="button"
              disabled={hasReachedLimit || extractLoading}
              onClick={() => libraryInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>🖼️</span>
              <span>Library</span>
            </button>
          </div>
        </div>
      ) : null}

      {undoState ? (
        <div className="fixed bottom-24 left-1/2 w-[92%] max-w-sm -translate-x-1/2 rounded-xl border border-white/20 bg-[#171c24] px-4 py-3 text-sm text-white shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <p>Photo removed</p>
            <button
              type="button"
              className="rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/10"
              onClick={undoRemove}
            >
              Undo
            </button>
          </div>
        </div>
      ) : null}

      {cameraOpen ? (
        <div className="fixed inset-0 z-10 flex items-end bg-black/85 p-4">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-white/20 bg-[#0f1318] p-3">
            <video
              ref={videoRef}
              className="mb-3 aspect-[3/4] w-full rounded-2xl bg-black object-cover"
              playsInline
              muted
              autoPlay
            />
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={closeCamera}
                className="flex-1 rounded-xl border border-white/20 px-4 py-3 text-sm font-medium text-white/85 hover:bg-white/10"
              >
                Close
              </button>
              <button
                type="button"
                onClick={captureFromVideo}
                className="flex-1 rounded-xl bg-[#f1b24a] px-4 py-3 text-sm font-semibold text-[#201608] hover:bg-[#f7c36b]"
              >
                Capture
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleLibrarySelect}
      />
      <input
        ref={cameraFallbackInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleCameraFallbackSelect}
      />
    </div>
  );
}

function stopCameraStream(
  streamRef: MutableRefObject<MediaStream | null>,
  videoRef: MutableRefObject<HTMLVideoElement | null>,
) {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
  }
  if (videoRef.current) {
    videoRef.current.srcObject = null;
  }
}
