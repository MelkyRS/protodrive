import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { createMockDb, mockData, mockDiscordFetch } from "./mocks";

const mockDb = createMockDb();
mock.module("../db", () => {
  return { default: mockDb };
});

mock.module("../lib/discord", () => {
  return {
    // Mock refreshing CDN URLs
    refreshDiscordUrls: mock((urls: string[]) =>
      Promise.resolve(
        urls.map((u) =>
          u.includes("ext")
            ? "http://discord.com/attachment/refreshed-mock"
            : u,
        ),
      ),
    ),
    getDiscordCDNUrl: mock(() =>
      Promise.resolve("http://discord.com/attachment/jit-mock"),
    ),
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

import download from "../routes/download";

describe("Download Router", () => {
  let cleanupFetch: () => void;

  beforeEach(() => {
    mockDb.__reset();
    cleanupFetch = mockDiscordFetch();
  });

  afterEach(() => {
    cleanupFetch();
  });

  test("GET /:id - Stream Full File", async () => {
    const fileId = "test-file-1";
    mockDb.__mockTable("files", { ...mockData.files[0] }, null);
    mockDb.__mockTable("chunks", mockData.chunks, null);

    const req = new Request(`http://localhost/${fileId}`);
    const res = await download.fetch(req);

    expect(res.status).toBe(200);
    // It returns a stream, so we can't easily parse JSON
    expect(res.headers.get("Content-Type")).toBe(mockData.files[0].type);
    const text = await res.text();
    expect(text).toBeDefined();
  });

  test("GET /chunk/:id - Refresh Expired Link", async () => {
    const fileId = "test-file-1";
    const chunkIdx = 0;

    // Expired URL (ex=1 is 1970)
    const expiredUrl = "http://discord.com/attachment/ext?ex=1";
    mockDb.__mockTable(
      "chunks",
      { ...mockData.chunks[0], url: expiredUrl },
      null,
    );

    const req = new Request(`http://localhost/chunk/${fileId}?idx=${chunkIdx}`);
    const res = await download.fetch(req);

    // Should redirect to the REFRESHED url from our mock
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      "http://discord.com/attachment/refreshed-mock",
    );

    // Verify DB was updated
    // In our mockDb, we can't easily verify the update occurred unless we check the table state
    // But the redirect proves the refreshed URL was used.
  });

  test("GET /chunk/:id - Get Single Chunk (Redirect or Logic)", async () => {
    // This route usually handles Discord CDN refresh and redirect or direct stream
    // Based on implementation in download.ts
    const fileId = "test-file-1";
    const chunkIdx = 0;

    mockDb.__mockTable("chunks", mockData.chunks[0], null);

    const req = new Request(`http://localhost/chunk/${fileId}?idx=${chunkIdx}`);
    const res = await download.fetch(req);

    // Router might redirect to Discord URL
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(mockData.chunks[0].url);
  });
});
