---
name: dynamic-category-schema
description: Build a Zod validation schema at runtime from a category's backend field-schema JSON, for MyList's variable per-category custom fields (price, size, condition, ...)
---

# Dynamic per-category Zod schema

MyList categories each define their own custom fields on the backend as a JSON list
of `{ key, type, required }` (see CLAUDE.md → "Variable fields per category"). Fixed
fields (title, tags, images) are the only ones hardcoded in this codebase — everything
else must be derived from that JSON at runtime. **Never hand-write a Zod schema for a
specific category.**

## The pattern

1. Get the category's field definitions from the generated API type (Orval output for
   the category endpoint) — don't hand-declare that type either.
2. Map each field definition to a Zod type via a single switch/lookup keyed on `type`.
3. Wrap in `z.optional()` (or `.nullish()` if the API can return `null`) when `required`
   is false.
4. Merge the resulting per-field shape with the fixed-fields schema (title/tags/images)
   into one object schema for the form.

```ts
import { z } from 'zod'
import type { CategoryFieldDefinition } from '@/api/generated' // Orval output — confirm actual path/name before using

function fieldToZod(field: CategoryFieldDefinition): z.ZodTypeAny {
  const base = (() => {
    switch (field.type) {
      case 'string':
        return z.string()
      case 'number':
        return z.coerce.number()
      case 'boolean':
        return z.boolean()
      case 'date':
        return z.coerce.date()
      case 'enum':
        return z.enum(field.options as [string, ...string[]])
      default:
        field.type satisfies never // exhaustiveness check against the real generated union
    }
  })()
  return field.required ? base : base.optional()
}

export function buildCategoryFieldsSchema(fields: CategoryFieldDefinition[]) {
  const shape = Object.fromEntries(fields.map((f) => [f.key, fieldToZod(f)]))
  return z.object(shape)
}
```

Then in the form:

```ts
const schema = fixedFieldsSchema.extend(
  buildCategoryFieldsSchema(category.fields).shape,
)
const form = useForm({ resolver: zodResolver(schema) })
```

## Watch out for

- **`field.type` union**: the switch above is illustrative. Once Orval generates the
  real type, swap in its actual union and let the `satisfies never` default catch
  anything unhandled at compile time.
- **Re-deriving on category change**: if the user can switch a list's category in the
  UI, rebuild the schema (and reset the form) when `category.id` changes — don't reuse
  a schema built for a different category's fields.
- **Server re-validates anyway**: per CLAUDE.md, this schema is a UX convenience. Don't
  add defensive parsing/fallbacks beyond what the form needs.
