import { useTransfer } from "@/context/TransferContext";
import { formatBytes } from "@/lib/utils";
import { ArrowDown, ArrowUp, Loader2, Pause, Play, X } from "lucide-react";
import { Button } from "./ui/button";

const formatDuration = (seconds: number) => {
  if (!seconds || !isFinite(seconds)) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export function TransferWidget() {
  const { upload, download, isUploadWidgetOpen, setIsUploadWidgetOpen } =
    useTransfer();

  const isActualDownload =
    download.isDownloading && download.mode === "download";
  const isBackgroundUpload = upload.isUploading && !isUploadWidgetOpen;

  const isActive =
    isActualDownload || isBackgroundUpload || !!download.isPaused;
  const isDownload = isActualDownload || !!download.isPaused;

  const progress = isDownload ? download.progress : upload.progress;
  const fileName = isDownload ? download.fileName : upload.currentFileName;
  const status = isDownload
    ? download.status
    : upload.upload.status === "uploading"
      ? "Uploading..."
      : "Finalizing...";
  const cancel = isDownload ? download.cancelDownload : upload.cancelUpload;

  const speed = (isDownload ? download.speed : upload.upload.speed) || 0;
  const eta = (isDownload ? download.eta : upload.upload.eta) || 0;

  if (!isActive) return null;

  return (
    <div
      className="fixed bottom-4 sm:bottom-6 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 cursor-pointer"
      onClick={() => {
        if (isBackgroundUpload) setIsUploadWidgetOpen(true);
      }}
    >
      <div className="relative bg-background/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-2xl px-3 sm:px-4 py-3 flex items-center gap-3 sm:gap-4 w-full sm:min-w-80 sm:max-w-[90vw] overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />

        {/* Progress fill background */}
        <div
          className="absolute inset-0 bg-primary/5 transition-all duration-500 ease-out pointer-events-none"
          style={{ width: `${progress}%` }}
        />

        {/* Icon */}
        <div className="relative shrink-0 w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          {status?.includes("Retrying") || status?.includes("Buffering") ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : isDownload ? (
            <ArrowDown className="h-4 w-4 text-primary" />
          ) : (
            <ArrowUp className="h-4 w-4 text-primary" />
          )}
        </div>

        {/* Text */}
        <div className="relative flex flex-col flex-1 min-w-0 gap-0.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold tracking-wide text-primary/90">
              {status || (isDownload ? "Downloading" : "Uploading")}
            </span>
            <span className="text-[11px] font-bold tabular-nums text-foreground/80">
              {progress}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground/70 truncate max-w-[120px] sm:max-w-40 font-medium">
              {fileName}
            </span>
            {progress < 100 && (
              <span className="text-[10px] text-muted-foreground/50 font-medium shrink-0">
                {formatBytes(speed)}/s · {formatDuration(eta)}
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="relative flex items-center gap-1 shrink-0">
          {isDownload && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                if (download.isPaused) {
                  download.resumeDownload();
                } else {
                  download.pauseDownload();
                }
              }}
            >
              {download.isPaused ? (
                <Play className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Pause className="h-3.5 w-3.5 fill-current" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              cancel();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
