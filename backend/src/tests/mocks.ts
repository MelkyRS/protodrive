import { mock } from "bun:test";

export const mockData = {
  files: [
    {
      id: "test-file-1",
      name: "test.txt",
      size: 1024,
      type: "text/plain",
      iv: "iv-1",
      salt: "salt-1",
      status: "active",
      created_at: new Date().toISOString(),
      search_vector: "'test':1",
    },
    {
      id: "test-file-2",
      name: "deleted.txt",
      size: 2048,
      type: "text/plain",
      iv: "iv-2",
      salt: "salt-2",
      status: "trashed",
      created_at: new Date().toISOString(),
      search_vector: "'deleted':1",
    },
  ],
  chunks: [
    {
      id: 1,
      file_id: "test-file-1",
      idx: 0,
      message_id: "msg-1",
      channel_id: "chan-1",
      size: 1024,
      url: "http://discord.com/attachment/1",
    },
  ],
};

// Mock Logger
mock.module("../lib/logger", () => {
  return {
    logger: {
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
    },
  };
});

interface TableResponse {
  data: any;
  error: any;
  count: number | null;
}

interface MockChain {
  select: (columns: string, options?: any) => MockChain;
  eq: (column: string, value: any) => MockChain;
  neq: (column: string, value: any) => MockChain;
  lt: (column: string, value: any) => MockChain;
  lte: (column: string, value: any) => MockChain;
  gt: (column: string, value: any) => MockChain;
  gte: (column: string, value: any) => MockChain;
  in: (column: string, values: any[]) => MockChain;
  is: (column: string, value: any) => MockChain;
  like: (column: string, pattern: string) => MockChain;
  ilike: (column: string, pattern: string) => MockChain;
  contains: (column: string, value: any) => MockChain;
  order: (column: string, options?: any) => MockChain;
  limit: (count: number) => MockChain;
  range: (from: number, to: number) => MockChain;
  single: () => MockChain;
  maybeSingle: () => MockChain;
  insert: (data: any | any[]) => MockChain;
  update: (data: any) => MockChain;
  delete: (options?: any) => MockChain;
  textSearch: (column: string, query: string, options?: any) => MockChain;
  rpc: (fn: string, args?: any) => MockChain;
  then: (resolve: (response: TableResponse) => void) => void;
  [key: string]: any; // Fallback for other methods
}

// Chainable Mock Builder
export const createMockDb = () => {
  const createChain = (tableData: TableResponse): MockChain => {
    const chain = {} as MockChain;
    const methods = [
      "select",
      "eq",
      "neq",
      "lt",
      "lte",
      "gt",
      "gte",
      "in",
      "is",
      "like",
      "ilike",
      "contains",
      "order",
      "limit",
      "range",
      "single",
      "maybeSingle",
      "insert",
      "update",
      "delete",
      "textSearch",
      "rpc",
    ];

    methods.forEach((method) => {
      if (method === "insert") {
        chain[method as keyof MockChain] = mock((data: any) => {
          const ret = Array.isArray(data) ? data : [data];
          tableData.data = ret;
          return chain;
        }) as any;
      } else {
        chain[method as keyof MockChain] = mock(() => chain) as any;
      }
    });

    chain.then = (resolve: (response: TableResponse) => void) =>
      resolve(tableData);
    return chain;
  };

  const tableMocks: Record<string, MockChain | undefined> = {};
  // Default chain for unmatched tables returning nulls
  const defaultChain = createChain({ data: null, error: null, count: null });

  return {
    from: mock((table: string) => {
      console.log(`[MockDB] from(${table})`);
      if (tableMocks[table]) {
        console.log(`[MockDB] found mock for ${table}`);
        return tableMocks[table];
      }
      console.log(`[MockDB] NO mock for ${table}, returning defaultChain`);
      return defaultChain;
    }),
    rpc: mock(() => defaultChain),

    // Helper to mock responses for specific tables
    __mockTable: (
      table: string,
      data: any,
      error: any = null,
      count: number | null = null,
    ) => {
      console.log(
        `[MockDB] __mockTable(${table}, data: ${JSON.stringify(data).slice(0, 100)}...)`,
      );
      const mockChain = createChain({ data, error, count });
      tableMocks[table] = mockChain;
      return mockChain;
    },

    __reset: () => {
      for (const key in tableMocks) delete tableMocks[key];
    },
  };
};

export const mockDiscordFetch = () => {
  const originalFetch = global.fetch;
  const mockFetch = mock(
    async (url: string | Request | URL, init?: RequestInit) => {
      const urlStr = url.toString();

      // Mock Discord CDN or API
      if (urlStr.includes("discord.com")) {
        // API Calls (JSON)
        if (urlStr.includes("/api/v")) {
          // Handle refresh-urls
          if (urlStr.includes("refresh-urls")) {
            return new Response(
              JSON.stringify({
                refreshed_urls: [
                  { refreshed: "http://discord.com/attachment/refreshed-mock" },
                ],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({
              id: "mock-msg-id",
              attachments: [
                {
                  id: "mock-att-id",
                  filename: "chunk",
                  size: 1024,
                  url: "http://discord.com/attachment/mock",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // CDN/Attachment Calls (Binary)
        return new Response(new Uint8Array(1024).fill(0x00), {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": "1024",
          },
        });
      }

      return originalFetch(url, init);
    },
  );

  global.fetch = mockFetch as any;
  return () => {
    global.fetch = originalFetch;
  };
};
