// The "Ask your AI" install prompt (R073). One source: the landing page's install tab and the docs page render this text.
export const MCP_PORT = 3333
export const MCP_URL = `http://localhost:${MCP_PORT}/api/mcp`

export const AI_INSTALL_PROMPT = `Install VibeDoc (https://github.com/quanghoangf/vibedoc) in this project and connect it to yourself. Follow these steps in order, and do not skip the report at the end.

Rules:
- Ask me before any command that needs admin rights (sudo, a global system path). If I say no, skip that step.
- Never edit my shell startup files (.zshrc, .bashrc, .profile, PowerShell profile).
- Never install or switch Node versions. If Node is missing or too old, stop and tell me.

1. Check Node: run \`node -v\`. VibeDoc needs Node.js 20.9 or newer.
2. Start VibeDoc on port ${MCP_PORT}, from this project's root folder:
   - First check whether it already runs: \`curl -s -X POST ${MCP_URL} -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'\`. If the answer lists tools named vibedoc_*, reuse it.
   - If something else answers on port ${MCP_PORT}, stop and ask me which port to use instead.
   - Otherwise start \`npx -y vibedoc@latest --port ${MCP_PORT}\` as a background process that keeps running after your command returns (your tool's background mode, or \`nohup … > /tmp/vibedoc.log 2>&1 &\`). Wait until the curl above lists the tools (up to 60 seconds).
3. Connect the MCP server (HTTP, ${MCP_URL}) for the tool you are:
   - Claude Code: \`claude mcp add --transport http vibedoc ${MCP_URL}\`.
   - Cursor: add \`"vibedoc": { "url": "${MCP_URL}" }\` under "mcpServers" in .cursor/mcp.json in the project root, keeping any servers already there.
   - Anything else: tell me the URL and that it is an HTTP (JSON-RPC) MCP server, and show me where your MCP config lives if you know it.
4. Claude Code only: install the VibeDoc skills plugin with \`claude plugin marketplace add quanghoangf/vibedoc\`, then \`claude plugin install vibedoc@vibedoc\`. It adds /vibedoc:roadmap, /vibedoc:breakdown, /vibedoc:work and /vibedoc:next.
5. Verify: call the vibedoc_get_status tool through the server: \`curl -s -X POST ${MCP_URL} -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"vibedoc_get_status","arguments":{}}}'\`. It should name this project.
6. Report back as a checklist, one line per step above: ✅ done, ⏭️ skipped (why) or ❌ failed (the error). Then tell me:
   - the board URL: http://localhost:${MCP_PORT}
   - to restart this session (Claude Code) or reload MCP servers (Cursor), so the vibedoc_* tools and /vibedoc:* commands load
   - the first thing to try: /vibedoc:roadmap to plan, or "list the VibeDoc tasks"`
