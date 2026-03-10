const DEFAULT_IMAGEKIT_PUBLIC_KEY = "public_7WASoXuU7mLSYjlA+DIy0BLm65Y=";
const IMAGEKIT_UPLOAD_ENDPOINT = "https://upload.imagekit.io/api/v1/files/upload";
const IMAGEKIT_AUTH_ENDPOINT = "/.netlify/functions/imagekit-auth";
const IMAGEKIT_UPLOAD_FOLDER = "/tenshop/products";

type ImageKitAuthResponse = {
  token: string;
  expire: number;
  signature: string;
};

type ImageKitUploadResponse = {
  url?: string;
  message?: string;
  help?: string;
};

function getImageKitPublicKey() {
  return (import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY as string | undefined)?.trim()
    || DEFAULT_IMAGEKIT_PUBLIC_KEY;
}

async function getImageKitAuth() {
  const response = await fetch(IMAGEKIT_AUTH_ENDPOINT);
  const payload = (await response.json()) as ImageKitAuthResponse & {
    error?: string;
    help?: string;
  };

  if (!response.ok) {
    throw new Error(payload.help || payload.error || "Image upload is not configured yet.");
  }

  return payload;
}

export async function uploadProductImage(file: File) {
  const publicKey = getImageKitPublicKey();
  if (!publicKey) {
    throw new Error("Missing ImageKit public key.");
  }

  const auth = await getImageKitAuth();
  const formData = new FormData();

  formData.append("file", file);
  formData.append("fileName", `${Date.now()}-${file.name}`);
  formData.append("publicKey", publicKey);
  formData.append("signature", auth.signature);
  formData.append("expire", String(auth.expire));
  formData.append("token", auth.token);
  formData.append("folder", IMAGEKIT_UPLOAD_FOLDER);
  formData.append("useUniqueFileName", "true");

  const response = await fetch(IMAGEKIT_UPLOAD_ENDPOINT, {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as ImageKitUploadResponse;

  if (!response.ok || !payload.url) {
    throw new Error(payload.help || payload.message || "Image upload failed.");
  }

  return payload.url;
}
