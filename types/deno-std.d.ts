declare module "std/http/server.ts" {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: {
      port?: number;
      hostname?: string;
      signal?: AbortSignal;
    }
  ): void;
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};
