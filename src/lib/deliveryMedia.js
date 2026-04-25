import { BrowserMultiFormatReader } from "@zxing/browser";
import jsQR from "jsqr";

import { hasSupabaseStorage, supabase, supabaseBucket } from "./supabase";

const barcodeFormats = [
  "qr_code",
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "codabar",
];

const barcodeReader = new BrowserMultiFormatReader();

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawSourceToCanvas(source) {
  const width =
    source.videoWidth ||
    source.naturalWidth ||
    source.width ||
    1280;
  const height =
    source.videoHeight ||
    source.naturalHeight ||
    source.height ||
    720;

  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

async function detectWithNativeDetector(source, mode) {
  if (typeof BarcodeDetector === "undefined") {
    return "";
  }

  const detector = new BarcodeDetector({ formats: barcodeFormats });
  const codes = await detector.detect(source);
  const rawValue = codes[0]?.rawValue || "";

  if (mode === "qr") {
    return rawValue;
  }

  const nonQrCode = codes.find((code) => code.format !== "qr_code");
  return nonQrCode?.rawValue || rawValue;
}

export function supportsNativeBarcodeDetector() {
  return typeof BarcodeDetector !== "undefined";
}

export async function detectQrValue(source) {
  const nativeValue = await detectWithNativeDetector(source, "qr");
  if (nativeValue) {
    return nativeValue;
  }

  const canvas = drawSourceToCanvas(source);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imageData.data, canvas.width, canvas.height, {
    inversionAttempts: "attemptBoth",
  });

  if (result?.data) {
    return result.data;
  }

  throw new Error("Nenhum QR code encontrado.");
}

export async function detectBarcodeValue(source) {
  const nativeValue = await detectWithNativeDetector(source, "barcode");
  if (nativeValue) {
    return nativeValue;
  }

  const canvas = drawSourceToCanvas(source);
  const result = await barcodeReader.decodeFromCanvas(canvas);
  const value = result?.getText?.() || result?.text || "";

  if (value) {
    return value;
  }

  throw new Error("Nenhum codigo de barras encontrado.");
}

export function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function buildStoragePath(fileName = "captura.jpg") {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `entregas/${Date.now()}-${safeName}`;
}

export async function uploadDeliveryPhoto(file) {
  if (!hasSupabaseStorage || !supabase) {
    return readImageFileAsDataUrl(file);
  }

  const path = buildStoragePath(file.name || "captura.jpg");
  const { error } = await supabase.storage.from(supabaseBucket).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/jpeg",
  });

  if (error) {
    throw new Error("Nao foi possivel enviar a foto para o Supabase.");
  }

  const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function capturePhotoFromVideo(video, canvas) {
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) {
          resolve(value);
          return;
        }

        reject(new Error("Nao foi possivel gerar a foto capturada."));
      },
      "image/jpeg",
      0.92,
    );
  });

  const file = new File([blob], `entrega-${Date.now()}.jpg`, {
    type: "image/jpeg",
  });

  return uploadDeliveryPhoto(file);
}
