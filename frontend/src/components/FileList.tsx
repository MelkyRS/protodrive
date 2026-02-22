import { FilePreviewModal } from "@/components/FilePreviewModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTransfer } from "@/context/TransferContext";
import { useFiles } from "@/hooks/use-files";
import { api } from "@/lib/api";
import { getFileIcon, isFileEncrypted, isPreviewable } from "@/lib/file-utils";
import { formatBytes } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Folder,
  Globe,
  Loader2,
  Lock,
  MoreVertical,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function FileList({
  status = "active",
}: {
  status?: "active" | "trashed";
}) {
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [fileToDelete, setFileToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isTrashDialogOpen, setIsTrashDialogOpen] = useState<boolean>(false);
  const [isEmptying, setIsEmptying] = useState<boolean>(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const PAGE_SIZE = 8;

  const { data, isLoading } = useFiles(page, PAGE_SIZE, search, status);
  const { download } = useTransfer();
  const { downloadFile, previewFile, clearPreview, ...state } = download;
  const { isDownloading, progress, fileName: activeFileName } = state;
  const queryClient = useQueryClient();

  const confirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);

    try {
      await api.delete(`/files/${fileToDelete.id}`);
      toast.success(
        status === "active"
          ? `Moved ${fileToDelete.name} to trash.`
          : `Permanently deleted ${fileToDelete.name}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["system-stats"] });
      setFileToDelete(null);
    } catch (error: unknown) {
      toast.error(`Failed to delete: ${(error as Error).message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async (fileId: string, fileName: string) => {
    setRestoringId(fileId);
    try {
      await api.post(`/files/${fileId}/restore`, {});
      toast.success(`${fileName} restored to library.`);
      queryClient.invalidateQueries({ queryKey: ["files"] });
    } catch (error: unknown) {
      toast.error(`Failed to restore: ${(error as Error).message}`);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 sm:space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/50" />
          <Input
            placeholder="Search in Drive"
            className="pl-9 sm:pl-11 h-9 sm:h-11 bg-secondary/20 border-border/10 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/10 text-xs sm:text-sm font-medium tracking-tight transition-all"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === "trashed" && (data?.items.length || 0) > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsTrashDialogOpen(true)}
              className="rounded-xl px-3 sm:px-4 gap-2"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border/40 bg-card/30 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="font-bold text-xs uppercase tracking-wider pl-4 sm:pl-6">
                  Name
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider hidden sm:table-cell">
                  Size
                </TableHead>
                <TableHead className="text-right pr-4 sm:pr-6 font-bold text-xs uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/5">
                  <TableCell className="py-3 pl-4 sm:pl-6">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                      <Skeleton className="h-4 w-24 sm:w-32" />
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="text-right pr-4 sm:pr-6">
                    <div className="flex items-center justify-end gap-1">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border/40 bg-card/30 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="font-bold text-xs uppercase tracking-wider pl-4 sm:pl-6">
                    Name
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider hidden sm:table-cell">
                    Size
                  </TableHead>
                  <TableHead className="text-right pr-4 sm:pr-6 font-bold text-xs uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((file, i) => (
                  <motion.tr
                    key={file.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className="group border-b border-border/5 hover:bg-primary/3 transition-colors data-[state=selected]:bg-muted"
                  >
                    <TableCell className="py-3 pl-4 sm:pl-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-primary/10 text-primary rounded-lg group-hover:scale-110 transition-transform shrink-0">
                          {getFileIcon(file.name)}
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 overflow-hidden">
                          <span
                            className="truncate font-medium text-foreground/90 max-w-[100px] xs:max-w-[140px] sm:max-w-[220px] md:max-w-[280px] lg:max-w-md text-xs sm:text-sm"
                            title={file.name}
                          >
                            {file.name}
                          </span>
                          {isFileEncrypted(file.iv, file.salt) ? (
                            <span
                              className="inline-flex items-center bg-primary/10 text-primary p-0.5 rounded shrink-0"
                              title="Encrypted"
                            >
                              <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center bg-emerald-500/10 text-emerald-500 p-0.5 rounded shrink-0"
                              title="Public"
                            >
                              <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap hidden sm:table-cell text-xs sm:text-sm">
                      {formatBytes(file.size)}
                    </TableCell>

                    <TableCell className="text-right pr-4 sm:pr-6">
                      <div className="flex items-center justify-end gap-1">
                        {isDownloading && activeFileName === file.name ? (
                          <motion.div
                            layout
                            className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 bg-primary/10 rounded-lg min-w-10 sm:min-w-12 justify-center"
                          >
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            {state.mode === "preview" && progress > 0 && (
                              <motion.span
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-[10px] font-bold text-primary tabular-nums"
                              >
                                {progress}%
                              </motion.span>
                            )}
                          </motion.div>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 sm:w-56"
                            >
                              <div className="px-3 py-3 bg-muted/30 rounded-t-md border-b border-border/10 mb-1">
                                <p
                                  className="text-xs font-bold text-foreground break-all whitespace-normal flex flex-wrap items-center gap-1.5"
                                  title={file.name}
                                >
                                  {file.name}
                                </p>
                                <div className="grid grid-cols-2 gap-y-1 text-[10px] text-muted-foreground mt-1">
                                  <div>
                                    <span className="font-semibold text-foreground/70">
                                      Size:
                                    </span>{" "}
                                    {formatBytes(file.size)}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-foreground/70">
                                      Chunks:
                                    </span>{" "}
                                    {file.chunks}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-foreground/70">
                                      Type:
                                    </span>{" "}
                                    {file.name
                                      .split(".")
                                      .pop()
                                      ?.toUpperCase() || "UNK"}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-foreground/70">
                                      Date:
                                    </span>{" "}
                                    {file.createdAt
                                      ? new Date(
                                          file.createdAt,
                                        ).toLocaleDateString()
                                      : "N/A"}
                                  </div>
                                </div>
                              </div>

                              <DropdownMenuSeparator />

                              {status === "active" ? (
                                <>
                                  {isPreviewable(file.name) && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        previewFile(file.id, file.name)
                                      }
                                    >
                                      <Eye className="mr-2 h-4 w-4" />
                                      <span>Preview</span>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() =>
                                      downloadFile(file.id, file.name)
                                    }
                                  >
                                    <Download className="mr-2 h-4 w-4" />
                                    <span>Download</span>
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />

                                  <DropdownMenuItem
                                    onClick={() =>
                                      setFileToDelete({
                                        id: file.id,
                                        name: file.name,
                                      })
                                    }
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Move to Trash</span>
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleRestore(file.id, file.name)
                                    }
                                    disabled={restoringId === file.id}
                                    className="text-green-500 focus:text-green-500"
                                  >
                                    {restoringId === file.id ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Undo2 className="mr-2 h-4 w-4" />
                                    )}
                                    <span>Restore</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setFileToDelete({
                                        id: file.id,
                                        name: file.name,
                                      })
                                    }
                                    className="text-destructive focus:text-destructive"
                                    disabled={restoringId === file.id}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Delete Forever</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {data?.items.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-48 sm:min-h-64 opacity-20">
              <Folder className="h-12 w-12 sm:h-16 sm:w-16 mb-4" />
              <p className="text-lg sm:text-xl font-black uppercase tracking-tighter">
                No files here
              </p>
            </div>
          )}
        </>
      )}

      {/* Modern Pagination */}
      {!isLoading && (data?.total || 0) > 0 && (
        <div className="flex items-center justify-between pt-2 sm:pt-4 gap-2">
          <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            Page <span className="text-foreground">{page + 1}</span> of{" "}
            {Math.ceil((data?.total || 0) / PAGE_SIZE)}
          </p>
          <div className="flex gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-8 rounded-lg border-border/40 px-2 sm:px-3"
            >
              <ChevronLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= (data?.total || 0)}
              className="h-8 rounded-lg border-border/40 px-2 sm:px-3"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4 sm:ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Empty Trash Confirmation */}
      <AlertDialog open={isTrashDialogOpen} onOpenChange={setIsTrashDialogOpen}>
        <AlertDialogContent className="bg-card border-border/40 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Empty Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              All items in the trash will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl border-border/40"
              disabled={isEmptying}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isEmptying}
              onClick={async (e) => {
                e.preventDefault();
                setIsEmptying(true);
                try {
                  await api.delete("/files/trash");
                  toast.success("Trash emptied.");
                  queryClient.invalidateQueries({ queryKey: ["files"] });
                  queryClient.invalidateQueries({ queryKey: ["system-stats"] });
                  setIsTrashDialogOpen(false);
                } catch {
                  toast.error("Operation failed.");
                } finally {
                  setIsEmptying(false);
                }
              }}
            >
              Empty Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Modal */}
      <FilePreviewModal
        isOpen={
          !!state.previewUrl || (isDownloading && state.mode === "preview")
        }
        onClose={clearPreview}
        fileName={state.fileName}
        fileUrl={state.previewUrl}
        isLoading={isDownloading && state.mode === "preview"}
        progress={progress}
        isEncrypted={(() => {
          const activeFile = data?.items.find((f) => f.name === state.fileName);
          return activeFile
            ? isFileEncrypted(activeFile.iv, activeFile.salt)
            : false;
        })()}
      />

      <AlertDialog
        open={!!fileToDelete}
        onOpenChange={(open) => !isDeleting && !open && setFileToDelete(null)}
      >
        <AlertDialogContent className="bg-card border-border/40 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {status === "active" ? "Move to Trash?" : "Delete Forever?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {status === "active"
                ? `Are you sure you want to move "${fileToDelete?.name}" to trash? You can still restore it later.`
                : `Are you sure you want to permanently delete "${fileToDelete?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl border-border/40"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (fileToDelete) confirmDelete();
              }}
              disabled={isDeleting}
            >
              {status === "active" ? "Move to Trash" : "Delete Forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
