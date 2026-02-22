import { describe, expect, test, mock, beforeEach } from "bun:test";
import { createMockDb, mockData } from "./mocks";

// Mock DB Module
const mockDb = createMockDb();
mock.module("../db", () => {
  return {
    default: mockDb,
  };
});

// Mock Discord Module
mock.module("../lib/discord", () => {
  return {
    bulkDeleteFromDiscord: mock(() => Promise.resolve()),
    uploadToDiscord: mock(() =>
      Promise.resolve({
        id: "mock-id",
        url: "mock-url",
        filename: "mock-file",
        size: 1024,
      }),
    ),
  };
});

// Import Router AFTER mocking
import files from "../routes/files";

describe("Files Router", () => {
  beforeEach(() => {
    mockDb.__reset();
  });

  test("GET / - List Files (Active)", async () => {
    // Setup Mock Return
    mockDb.__mockTable(
      "files",
      mockData.files.filter((f) => f.status === "active"),
      null,
      1,
    );

    const req = new Request("http://localhost/?status=active");
    const res = await files.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.items).toBeArray();
    expect(json.data.items.length).toBe(1);
    expect(json.data.items[0].id).toBe("test-file-1");
  });

  test("GET /:id - Get File Details", async () => {
    // Mock Files table
    mockDb.__mockTable("files", { ...mockData.files[0] }, null);
    // Mock Chunks table
    mockDb.__mockTable("chunks", mockData.chunks, null);

    const req = new Request("http://localhost/test-file-1");
    const res = await files.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe("test-file-1");
    expect(json.data.chunks).toBeArray();
    expect(json.data.chunks.length).toBe(1);
  });

  test("POST /:id/restore - Restore File", async () => {
    // 1. Check if file exists (trashed)
    mockDb.__mockTable("files", { status: "trashed" }, null);

    // 2. Perform Update
    // The router calls .update().eq()
    // Our mock executes update and returns data/error as configured.
    // We can just configure the 'files' table mock to be reused or updated.

    const req = new Request("http://localhost/test-file-2/restore", {
      method: "POST",
    });
    const res = await files.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  test("DELETE /:id - Soft Delete", async () => {
    // 1. Fetch file status (active)
    mockDb.__mockTable("files", { status: "active", name: "test" }, null);

    const req = new Request("http://localhost/test-file-1", {
      method: "DELETE",
    });
    const res = await files.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.message).toContain("trash");
  });

  test("DELETE /:id - Hard Delete", async () => {
    // 1. Fetch file status (trashed)
    mockDb.__mockTable("files", { status: "trashed", name: "test" }, null);
    // 2. Fetch chunks
    mockDb.__mockTable("chunks", mockData.chunks, null);

    const req = new Request("http://localhost/test-file-2", {
      method: "DELETE",
    });
    const res = await files.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.message).toContain("permanently deleted");
  });
});
