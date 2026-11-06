import { defineConfig } from 'orval'

// The backend's OpenAPI snapshot is the contract (CONTRACTS.md). CI sets API_SPEC to the
// snapshot on the backend's main branch; locally it comes from the sibling checkout.
const input = process.env.API_SPEC ?? '../my-list-be/openapi/openapi.json'

export default defineConfig({
  api: {
    input,
    output: {
      mode: 'single',
      target: 'src/api/generated/api.ts',
      schemas: 'src/api/generated/models',
      client: 'axios-functions',
      clean: true,
      override: {
        // Routes requests through the shared axios instance so errors become ApiError.
        mutator: { path: 'src/lib/orval-mutator.ts', name: 'orvalMutator' },
      },
    },
  },
})
