import { describe, expect, test, mock, beforeEach } from "bun:test";
import { createMockDb, mockData } from "./mocks";

const mockDb = createMockDb();
mock.module("../db", () => {
  return { default: mockDb };
});

mock.module("../lib/discord", () => {
  return {
    uploadToDiscord: mock(() =>
      Promise.resolve({
        id: "1234567890",
        url: "http://discord.com/attachment/123",
        filename: "chunk",
        size: 1024,
      }),
    ),
    bulkDeleteFromDiscord: mock(() => Promise.resolve()),
  };
});

import upload from "../routes/upload";

describe("Upload Router", () => {
  beforeEach(() => {
    mockDb.__reset();
  });

  test("POST /file/init - Init Upload", async () => {
    // Mock checking for existing file: returns empty
    mockDb.__mockTable("files", [], null);

    // Mock insert: returns new file data
    const newFile = { ...mockData.files[0], status: "pending" };
    mockDb.__mockTable("files", [newFile], null);

    const body = {
      name: "new-upload.txt",
      size: 1024,
      type: "text/plain",
      iv: "iv",
      salt: "salt",
      id: mockData.files[0].id, // Add ID to body as expected by route
    };
    const req = new Request("http://localhost/file/init", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await upload.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  test("POST /file/:id/chunk - Upload Chunk", async () => {
    const fileId = "test-file-1";
    const formData = new FormData();
    formData.append("chunk", new Blob(["test content"]), "chunk");
    formData.append("idx", "0");
    formData.append("totalChunks", "1");
    formData.append("fileId", fileId);

    // Mock DB: Check file exists (pending/active)
    mockDb.__mockTable("files", [{ id: fileId, status: "pending" }], null);

    // Mock DB: Check for existing chunk (idempotency) -> return null
    // Then insert chunk
    // Then double check file exists
    mockDb.__mockTable("chunks", [], null); // existing chunk check

    // We need to verify the sequence or just ensure mocks return what is needed.
    // The router calls:
    // 1. files.select(id).eq(pending) -> returns {id}
    // 2. chunks.select.eq.eq.single -> returns null (no dup)
    // 3. files.select(id).eq(pending) -> returns {id}
    // 4. chunks.insert -> returns error/null (Supabase return null on success insert if no select)

    // Our mock reuses the table mock.
    // files -> [{id: ...}] is fine.
    // chunks -> [] (empty for duplicate check).

    const req = new Request(`http://localhost/file/${fileId}/chunk`, {
      method: "POST",
      body: formData,
    });

    const res = await upload.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  test("POST /file/:id/finalize - Finalize Upload", async () => {
    const fileId = "test-file-1";

    // Mock DB: Update file status
    mockDb.__mockTable("files", [{ id: fileId, status: "active" }], null);

    const req = new Request(`http://localhost/file/${fileId}/finalize`, {
      method: "POST",
      body: JSON.stringify({ fileId }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await upload.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
