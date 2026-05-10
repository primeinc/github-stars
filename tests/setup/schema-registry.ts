// Side-effect imports populate GhStarsSchemaRegistry before any test runs.
// Each contract owner runs its .register(...) calls at module load. Lets
// tests rely on registry presence without per-file imports.
//
// Add new contract owners here as they land in src/contracts/ and
// src/manifest/.

import "../../src/contracts/registry.js";
// Future contract modules go here once they exist:
//   import "../../src/contracts/env.js";
//   import "../../src/contracts/paths-config.js";
//   import "../../src/manifest/schema.zod.js";
//   import "../../src/telemetry/contracts.zod.js";
