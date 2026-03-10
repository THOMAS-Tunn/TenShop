import { useRef } from "react";

type ProductImageFieldProps = {
  label: string;
  value: string;
  previewAlt: string;
  uploading: boolean;
  onChange: (value: string) => void;
  onUpload: (file: File) => void | Promise<void>;
};

export function ProductImageField({
  label,
  value,
  previewAlt,
  uploading,
  onChange,
  onUpload,
}: ProductImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>

      <div className="grid gap-4 md:grid-cols-[140px_1fr]">
        <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {value ? (
            <img src={value} alt={previewAlt} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
              No image selected
            </div>
          )}
        </div>

        <div className="grid gap-3">
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-2 outline-none transition focus:border-slate-400"
            placeholder="Paste image URL here"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onUpload(file);
              event.target.value = "";
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Upload image"}
            </button>

            {value ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="text-xs text-slate-500">
            Paste an image URL or upload a file to ImageKit.
          </div>
        </div>
      </div>
    </div>
  );
}
