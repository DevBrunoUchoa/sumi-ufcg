import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Testes unitários usam repositórios fake (ver *.service.test.ts) e nunca
    // tocam o Supabase de verdade — só precisamos de valores válidos o
    // suficiente para src/config/env.ts não falhar ao ser importado.
    env: {
      NODE_ENV: "test",
      SUPABASE_URL: "https://example-test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
  },
});
