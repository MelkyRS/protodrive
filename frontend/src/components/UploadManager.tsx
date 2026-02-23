import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { cn, formatBytes } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  FileIcon,
  FileUp,
  Globe,
  Loader2,
  Lock,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";

import { useTransfer } from "@/context/TransferContext";

export function UploadWidget() {
  const {
    upload: uploadState,
    setIsUploadWidgetOpen: onOpenChange,
    isUploadWidgetOpen: open,
  } = useTransfer();
  const { upload, uploadFiles, cancelUpload, clearUpload } = uploadState;
  const [dragActive, setDragActive] = useState(false);
  const [shouldEncrypt, setShouldEncrypt] = useState(true);

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond === 0) return "0 KB/s";
    const kbps = bytesPerSecond / 1024;
    if (kbps < 1024) return `${kbps.toFixed(1)} KB/s`;
    return `${(kbps / 1024).toFixed(1)} MB/s`;
  };

  const formatETA = (seconds: number) => {
    if (seconds <= 0) return "calculating...";
    if (seconds < 60) return `${Math.round(seconds)}s remaining`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s remaining`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(Array.from(e.target.files), shouldEncrypt);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        uploadFiles(Array.from(e.dataTransfer.files), shouldEncrypt);
      }
    },
    [uploadFiles, shouldEncrypt],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-lg bg-card/95 backdrop-blur-3xl border-0 ring-0 focus:ring-0 outline-none p-0 overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl"
      >
        <DialogHeader className="px-4 pt-4 pb-0 sm:p-6 sm:pb-0 flex flex-row items-center justify-between">
          <div className="space-y-1 text-left">
            <DialogTitle className="text-2xl sm:text-3xl font-black tracking-tighter uppercase flex items-center gap-2">
              <FileUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              Upload Files
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium text-xs">
              AES-256 Encrypted & Distributed Storage
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full -mr-1 -mt-1 sm:-mr-2 sm:-mt-2 opacity-70 hover:opacity-100 shrink-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="px-4 py-4 sm:p-6 space-y-4 sm:space-y-6"
        >
          {upload.status === "idle" ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <RadioGroup
                defaultValue="encrypted"
                value={shouldEncrypt ? "encrypted" : "standard"}
                onValueChange={(v) => setShouldEncrypt(v === "encrypted")}
                className="grid grid-cols-2 gap-3 w-full sm:max-w-xs"
              >
                <div>
                  <RadioGroupItem
                    value="encrypted"
                    id="encrypted"
                    className="peer sr-only"
                  />
                  <label
                    htmlFor="encrypted"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer transition-all"
                  >
                    <Lock className="mb-1 h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Encrypted
                    </span>
                  </label>
                </div>
                <div>
                  <RadioGroupItem
                    value="standard"
                    id="standard"
                    className="peer sr-only"
                  />
                  <label
                    htmlFor="standard"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:text-emerald-500 cursor-pointer transition-all"
                  >
                    <Globe className="mb-1 h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Standard
                    </span>
                  </label>
                </div>
              </RadioGroup>
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                  "relative group w-full flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-5 sm:p-6 transition-all duration-300",
                  dragActive
                    ? "border-primary bg-primary/5 scale-[0.98]"
                    : "border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  {shouldEncrypt ? (
                    <Lock className="h-5 w-5" />
                  ) : (
                    <Globe className="h-5 w-5" />
                  )}
                </div>
                <p className="text-xs font-bold text-foreground mb-0.5">
                  Drag & Drop Files
                </p>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
                  or click to browse
                </p>
                <input
                  type="file"
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={handleFileChange}
                />
              </div>

              <p className="text-[10px] text-center text-muted-foreground/60 font-medium px-2 sm:px-4 max-w-xs leading-tight">
                {shouldEncrypt
                  ? "Files Are Encrypted With AES-256."
                  : "Standard Upload, Files Stored For Instant Preview."}
              </p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6 bg-muted/40 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border/20">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center shrink-0 animate-pulse">
                  <FileIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="flex-1 min-w-0 grid gap-1">
                  <p
                    className="font-bold text-sm truncate"
                    title={upload.currentFileName}
                  >
                    {upload.currentFileName}
                  </p>
                  <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1.5">
                      {upload.status === "uploading" && (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          Uploading...
                        </>
                      )}
                      {upload.status === "success" && (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span className="text-green-500">Uploaded</span>
                        </>
                      )}
                      {upload.status === "error" && (
                        <>
                          <AlertCircle className="h-3 w-3 text-destructive" />
                          <span className="text-destructive">
                            Upload Failed
                          </span>
                        </>
                      )}
                    </p>
                    {upload.status === "uploading" && (
                      <div className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-border rounded-full" />
                        <span className="text-[10px] text-primary font-black uppercase tracking-widest">
                          {formatSpeed(upload.speed)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest px-1">
                    <span className="text-primary">
                      {upload.progress}% Complete
                    </span>
                    <span className="text-muted-foreground">
                      {formatBytes(upload.uploadedBytes)} /{" "}
                      {formatBytes(upload.totalSize)}
                    </span>
                  </div>
                  <Progress
                    value={upload.progress}
                    className="h-2 rounded-full overflow-hidden bg-primary/10"
                  >
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </Progress>
                  {upload.status === "uploading" && (
                    <div className="flex justify-between items-end">
                      <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-[0.15em]">
                        {upload.totalFiles > 1 &&
                          `File ${upload.currentFileIndex + 1} of ${upload.totalFiles} • `}
                        Chunk {upload.uploadedChunks}/{upload.totalChunks}
                      </p>
                      <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-[0.15em] text-right">
                        {formatETA(upload.eta)}
                      </p>
                    </div>
                  )}
                </div>

                {upload.status === "uploading" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-2xl h-10 border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive/40 font-bold uppercase tracking-widest text-[10px]"
                    onClick={cancelUpload}
                  >
                    Cancel Upload
                  </Button>
                )}

                {upload.status === "success" && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <Button
                      className="w-full rounded-xl font-bold h-10"
                      variant="outline"
                      onClick={() => {
                        clearUpload?.();
                      }}
                    >
                      Upload More
                    </Button>
                    <Button
                      className="w-full rounded-xl font-bold h-10"
                      variant="secondary"
                      onClick={() => {
                        clearUpload?.();
                        onOpenChange(false);
                      }}
                    >
                      Done
                    </Button>
                  </div>
                )}

                {upload.status === "error" && (
                  <Button
                    className="w-full rounded-xl font-bold h-10"
                    variant="destructive"
                    onClick={() => {
                      clearUpload?.();
                      onOpenChange(false);
                    }}
                  >
                    Dismiss Error
                  </Button>
                )}
              </div>
            </div>
          )}
        </motion.div>

        <div className="bg-background/40 px-4 py-3 border-t border-border/10 flex items-center justify-center">
          <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
            © {new Date().getFullYear()} Proto Drive
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
