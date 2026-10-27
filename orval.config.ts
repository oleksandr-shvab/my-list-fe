import { defineConfig } from 'orval'

// The backend's OpenAPI snapshot is the contract (see CONTRACTS.md). Locally it is read from the
// sibling backend checkout; CI points API_SPEC at the snapshot on the backend's main branch.
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
        // Requests go through the shared axios instance, so errors become ApiError.
        mutator: { path: 'src/lib/orval-mutator.ts', name: 'orvalMutator' },
      },
    },
  },
})
