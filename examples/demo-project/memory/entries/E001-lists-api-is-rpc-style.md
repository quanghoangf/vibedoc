# E001: Lists API is RPC-style: POST for every write, ids in the body
**Type:** convention
**Updated:** 2026-09-18
**By:** human

No REST verbs beyond GET and POST. List endpoints take `list_id` in the JSON body, never in the path. See docs/api/lists.md.
