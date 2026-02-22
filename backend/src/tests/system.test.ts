import { describe, expect, test, mock } from "bun:test";
import { createMockDb } from "./mocks";

const mockDb = createMockDb();
mock.module("../db", () => {
  return { default: mockDb };
});

import system from "../routes/system";

describe("System Router", () => {
  test("GET /health - Check System Health", async () => {
    // Mock DB Success
    mockDb.__mockTable("files", [{ id: "1" }], null);

    const req = new Request("http://localhost/health");
    const res = await system.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.database).toBe("online");
    expect(json.data.version).toBeDefined();
  });

  test("GET /stats - Check Storage Stats", async () => {
    // Mock DB Counts
    mockDb.__mockTable("files", [], null, 42); // Count = 42
    // Mock RPC for total size
    // rpc() returns default chain which resolves to { data: null }
    // We need to intercept rpc call.
    // The mockDb.rpc returns defaultChain.
    // We can just rely on the default null return or improve mock if needed.

    const req = new Request("http://localhost/stats");
    const res = await system.fetch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.storage.totalFiles).toBe(42);
  });
});
