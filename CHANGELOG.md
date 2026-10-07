# [1.20.0](https://github.com/quanghoangf/vibedoc/compare/v1.19.0...v1.20.0) (2026-10-07)


### Features

* **board:** task panel shows dependencies, tests, runs, findings and chat at a glance (T509) ([eae6e91](https://github.com/quanghoangf/vibedoc/commit/eae6e911d627acb77502eb63e4c16314319c7420))
* **docs:** open a task doc's manual tests in Test review ([1e61778](https://github.com/quanghoangf/vibedoc/commit/1e61778055f3baf992dd1b88d6f9881283b7fde1))

# [1.19.0](https://github.com/quanghoangf/vibedoc/compare/v1.18.0...v1.19.0) (2026-10-07)


### Bug Fixes

* **chat:** agent turns run on the server and survive a page reload ([1ce0c9f](https://github.com/quanghoangf/vibedoc/commit/1ce0c9f59375df18d6ed30fca654d0e778832ac1))
* **docs:** fixed-height docs explorer that scrolls by itself ([b09f3b9](https://github.com/quanghoangf/vibedoc/commit/b09f3b9725371666da7a55f8ee3f2f71a4265abe))


### Features

* **board:** New Task modal with pickers, image attachments and agent start (T512) ([b8208df](https://github.com/quanghoangf/vibedoc/commit/b8208dff58d76dd5a077c2a99383a7dfb4bffb57))
* **board:** quick review of a task's manual tests from the board (T510) ([f0996ca](https://github.com/quanghoangf/vibedoc/commit/f0996ca4e3466813e4a3030c83c9353e62cf5659))
* **board:** resizable task panel, open full document (⇧O), no edit form in the panel ([7a470f0](https://github.com/quanghoangf/vibedoc/commit/7a470f097d375ca345f252e785544de4655a87df))
* **docs:** show a task's or epic's meta block as property rows ([4f6f4b2](https://github.com/quanghoangf/vibedoc/commit/4f6f4b253899c0e67b4a9798bb3631835a68a550))
* **docs:** T506 linked docs panel lists each file once with its direction ([0830dea](https://github.com/quanghoangf/vibedoc/commit/0830dea06bf9bb8ccc230fd86c22c728958d2a6d))
* **roadmap:** epic pane docked left, task detail beside it (T508) ([fd56a09](https://github.com/quanghoangf/vibedoc/commit/fd56a09abbf38a61721bfde94458e7e1a1c0fe07))
* **sidebar:** collapsible page children with needs-action and recent items ([216b5c6](https://github.com/quanghoangf/vibedoc/commit/216b5c6fe3e550db2b8317ccbfa7fc39799eba7a))
* **sidebar:** pure page-children picker and recent-items cookie ([8a870f2](https://github.com/quanghoangf/vibedoc/commit/8a870f2adc03ca00ad035ce085071c94695e1d2a))

# [1.18.0](https://github.com/quanghoangf/vibedoc/compare/v1.17.0...v1.18.0) (2026-10-07)


### Features

* **cli:** vibedoc check runs the docs lint without the app (T420) ([dd96e09](https://github.com/quanghoangf/vibedoc/commit/dd96e0995ebec83b67d20a8bef127d59053d2dd3))
* **docs:** agent-only and human-only blocks in agent reads (T360) ([3baaecf](https://github.com/quanghoangf/vibedoc/commit/3baaecfbf7667170ae509f8bdf46614edc2b524a))
* **docs:** API reference view for the project's OpenAPI spec ([de20fea](https://github.com/quanghoangf/vibedoc/commit/de20feae9fd56c7afc913611e8c0c63ed3c86432))
* **docs:** callout and collapsible toolbar inserts (T403) ([077a5f5](https://github.com/quanghoangf/vibedoc/commit/077a5f5019cdc12fa2edc9a629036dbde2c72faa))
* **docs:** copy page, view as markdown, agent link and audience blocks in the editor (T365) ([21130cd](https://github.com/quanghoangf/vibedoc/commit/21130cd22c823910b38c676659c477660c7c099b))
* **docs:** doc lint with vibedoc_check_docs and GET /api/docs/lint (T381) ([662ce48](https://github.com/quanghoangf/vibedoc/commit/662ce48855e8da44488e4d23aaba74d7cb124768))
* **docs:** docs check line and issue panel on /docs (T383) ([7f1a6ed](https://github.com/quanghoangf/vibedoc/commit/7f1a6ed98c94d47b6f4eb9d1a86fed4f121f007e))
* **docs:** flag docs naming paths a done task renamed or deleted (T460) ([5a03565](https://github.com/quanghoangf/vibedoc/commit/5a035655b5dcc0fc2e6147a2d49e1d868b6579f5))
* **docs:** group titled fences into code tabs (T401) ([154b4bc](https://github.com/quanghoangf/vibedoc/commit/154b4bc4819458120bf8538bc59e345511ee74ad))
* **docs:** lint orphan docs, capability specs and spec changes (T382) ([166b742](https://github.com/quanghoangf/vibedoc/commit/166b7422d851ea7cf24b2d56cb09ae463b3a78df))
* **docs:** May be outdated box and Fix docs on the doc (T461) ([eb9b885](https://github.com/quanghoangf/vibedoc/commit/eb9b88590413fc7da7ec5b4573819276e1a51be9))
* **docs:** rank doc search by title, heading, body over cached files (T380) ([9b2dd8a](https://github.com/quanghoangf/vibedoc/commit/9b2dd8a9037178c32789f4533e575907113283ed))
* **docs:** record agent doc reads and show them on /docs (T480) ([c8dcd0a](https://github.com/quanghoangf/vibedoc/commit/c8dcd0abcbdd6e5c2445e7426e45b7df8ef49daf))
* **docs:** render GFM alerts as callouts (T400) ([829dcf6](https://github.com/quanghoangf/vibedoc/commit/829dcf63775b975cc7b64b4aa406c77c8963001b))
* **docs:** serve /llms.txt from the project's files (T363) ([237c9a0](https://github.com/quanghoangf/vibedoc/commit/237c9a06095a76d211684ca696964dcf9f583b3d))
* **docs:** serve each doc as markdown at /md/<path> (T361) ([7863e0b](https://github.com/quanghoangf/vibedoc/commit/7863e0bd69f44a54aaa89f863166b79996c06f8a))
* **docs:** show agent searches that found nothing on /docs (T481) ([5343e91](https://github.com/quanghoangf/vibedoc/commit/5343e91f5b9368672dcd0d51be21499489a6d092))
* **docs:** style details blocks as an accordion (T402) ([24f6d7b](https://github.com/quanghoangf/vibedoc/commit/24f6d7bb12cfdefbbe6513b6e1504902525a24f8))
* **docs:** suggest similar docs on a wrong path (T362) ([409e2f0](https://github.com/quanghoangf/vibedoc/commit/409e2f02c0a981d356dc25400e6d4eab75079850))
* **docs:** Try it sends API reference requests to the project's local app ([f40e42d](https://github.com/quanghoangf/vibedoc/commit/f40e42d567e56ee3e0cc85c40669ec36f1b1de8c))
* **mcp:** context header on vibedoc_read_doc (T364) ([080c2cf](https://github.com/quanghoangf/vibedoc/commit/080c2cfabc9d45676730e597db406391606c6679))
* **openapi:** parse the project's OpenAPI spec and add vibedoc_get_endpoint ([49486e0](https://github.com/quanghoangf/vibedoc/commit/49486e05a6fad9ecd873a7b1311b7a09afc0245b))
* **release-notes:** draft from done work since the last tag at GET /api/release-notes (T441) ([2301101](https://github.com/quanghoangf/vibedoc/commit/23011015579ed1da46917026a148020168afc31b))
* **release-notes:** pick new done work and build the CHANGELOG edit (T440) ([1e1378a](https://github.com/quanghoangf/vibedoc/commit/1e1378afc71457acc1b932c6ca13c7258214d7ba))
* **roadmap:** Draft release notes from done work as a CHANGELOG diff (T442) ([db400fc](https://github.com/quanghoangf/vibedoc/commit/db400fc4a9d98826f8772668f34de680cdc7a9f7))

# [1.17.0](https://github.com/quanghoangf/vibedoc/compare/v1.16.0...v1.17.0) (2026-10-07)


### Bug Fixes

* **cli:** set the start page after --demo is parsed ([c902aa0](https://github.com/quanghoangf/vibedoc/commit/c902aa083c7c1923be6a42a03dd63b2b825b972b))
* **connect:** the in-app chat's tool calls no longer count as a connected agent (T250) ([3042e7d](https://github.com/quanghoangf/vibedoc/commit/3042e7d487d76967c1ab3ba897d0b851626c7b0a))
* **demo:** commit the sample's activity log, which .gitignore caught (T334) ([1d8c267](https://github.com/quanghoangf/vibedoc/commit/1d8c267c53135bd976f670b46fef4df7f0d5cd16))
* **feedback:** retry unsent steps, skip step events when opted out ([1c8e2cf](https://github.com/quanghoangf/vibedoc/commit/1c8e2cf520d5b23f27302d4d203d71940bfc2026))


### Features

* **board:** teaching empty state with copy command and agent connect line (T290) ([b9e8762](https://github.com/quanghoangf/vibedoc/commit/b9e876254f7630bdecc5e69a200baeb0aed1127e))
* **cli:** open the browser only when the app answers, explain a failed start (T233) ([21662c2](https://github.com/quanghoangf/vibedoc/commit/21662c2568606694a828b358ef628b1131f9ef42))
* **cli:** reuse a running VibeDoc, else move ports and say how to reconnect (T232) ([2a2f59c](https://github.com/quanghoangf/vibedoc/commit/2a2f59cef23eb5749cf591eb6e56b6b086c76c33))
* **cli:** same address for a project on every run, print MCP URL and connect command (T231) ([95c61f8](https://github.com/quanghoangf/vibedoc/commit/95c61f8c4134e9f455c61055c8b14c985375da7e))
* **connect:** connection evidence and Connect agent panel with a live MCP step (T250) ([ff90e91](https://github.com/quanghoangf/vibedoc/commit/ff90e916ce925d6ad1649b46c8a32c07562d2b37))
* **connect:** Cursor and other agents get a config to paste with the same live check (T253) ([d268d3d](https://github.com/quanghoangf/vibedoc/commit/d268d3d0de533e0413db59c607d00ce10e955f42))
* **connect:** one-click Claude Code MCP connect with confirm and replace (T251) ([76ddd46](https://github.com/quanghoangf/vibedoc/commit/76ddd46d20650c63d1d021939c198f201ddda6e8))
* **connect:** skills step detects and installs the vibedoc plugin (T252) ([577b3a0](https://github.com/quanghoangf/vibedoc/commit/577b3a06c0088efd5a9e561184e6244db658247d))
* **demo:** a lived-in sample with chats, activity, scenarios and dates near today (T332) ([0fbcf92](https://github.com/quanghoangf/vibedoc/commit/0fbcf923315b37c0134d5c78a119000ccaf452c1))
* **demo:** a recorded sample test run with a playable evidence video (T333) ([29ca5c3](https://github.com/quanghoangf/vibedoc/commit/29ca5c31d3bdbc409b67f9a32227b002bbd23780))
* **demo:** the demo runs no agents and leaves nothing behind (T331) ([d3fb059](https://github.com/quanghoangf/vibedoc/commit/d3fb05935cee1d8d3a2da3046f61590d56816a37))
* **demo:** Try the demo on the site and in the docs, and the epic's end-to-end check (T334) ([53f88b0](https://github.com/quanghoangf/vibedoc/commit/53f88b0ad263c7564566c392fa7af9d7758eac5e))
* **demo:** vibedoc --demo opens a throwaway sample project with a Demo banner (T330) ([a149e4c](https://github.com/quanghoangf/vibedoc/commit/a149e4cf26a1e572600d9e9b72aa32de31645374))
* **feedback:** consent card and anonymous first-run step events (T350) ([e2020ab](https://github.com/quanghoangf/vibedoc/commit/e2020abed46c6ca2133d18c1e7e8a179ff0d8bb9))
* **feedback:** first-run funnel script and privacy docs (T353) ([bfd21ec](https://github.com/quanghoangf/vibedoc/commit/bfd21eccc206beab690bc23a1f380529e6222ae7))
* **feedback:** Settings → Privacy switch for first-run feedback (T351) ([1b0ef0c](https://github.com/quanghoangf/vibedoc/commit/1b0ef0cb543bc089c59dad848dff4b0876300329))
* **feedback:** Stuck? Tell us link to a prefilled GitHub issue (T352) ([e6e51b3](https://github.com/quanghoangf/vibedoc/commit/e6e51b38029f21e7a295687c347b220d8bcff94d))
* **first-run:** agent row and optional Write project docs on the welcome (T271) ([af86939](https://github.com/quanghoangf/vibedoc/commit/af86939a9986dc9831160e2e0fbb173cc2bbb32e))
* **first-run:** project-aware first screen and /start welcome (T270) ([1a037c7](https://github.com/quanghoangf/vibedoc/commit/1a037c74010195167916bf5652c270df40c9f387))
* **first-run:** reopen the last page used on a set-up project (T272) ([b8a0337](https://github.com/quanghoangf/vibedoc/commit/b8a03373cbae65fd9c5c8be8037cc6c5bd9fd358))
* **memory:** teaching empty states for memory, activity and chat (T292) ([710fa16](https://github.com/quanghoangf/vibedoc/commit/710fa165f6c6b61926d53d565b877c056b0ad5ff))
* **onboarding:** dismiss the first-week checklist per project, All done when finished (T312) ([19c6260](https://github.com/quanghoangf/vibedoc/commit/19c62609a9b6d26a64680ae299181a6b355611bd))
* **onboarding:** first-week checklist derived from the project, live in the sidebar (T310) ([70b8f1d](https://github.com/quanghoangf/vibedoc/commit/70b8f1dfe64a1fb26fe9bb331d47a72842644059))
* **onboarding:** first-week next step is one click, page link or command to copy (T311) ([d0ef027](https://github.com/quanghoangf/vibedoc/commit/d0ef0278574e0f2e0171ecfedbf25230edc69e58))
* **roadmap:** teaching empty states for roadmap, graph, docs and explorer (T291) ([1615ff8](https://github.com/quanghoangf/vibedoc/commit/1615ff806dc302be528620d20905305c6371fb8a))
* **testing:** teaching empty states for test review, suite and run player (T293) ([86f99f0](https://github.com/quanghoangf/vibedoc/commit/86f99f0f2117c7318f9a60834bbbc742d172ae52))

# [1.16.0](https://github.com/quanghoangf/vibedoc/compare/v1.15.0...v1.16.0) (2026-10-06)


### Features

* **i18n:** board in Vietnamese with views, cards, task panel and shared parts (T217) ([5caf2b4](https://github.com/quanghoangf/vibedoc/commit/5caf2b421c1cff3c92b3d482f98c7f67c331c836))
* **i18n:** chat, setup and getting started in Vietnamese (T222) ([2d044a7](https://github.com/quanghoangf/vibedoc/commit/2d044a7d30785ed306f82e892895f5d13361ac8c))
* **i18n:** dates and numbers follow the UI language, Vietnamese letters in fonts (T216) ([d6228c0](https://github.com/quanghoangf/vibedoc/commit/d6228c04a7f9419c01d40611caee267d1082ee89))
* **i18n:** docs and file explorer in Vietnamese (T219) ([6910559](https://github.com/quanghoangf/vibedoc/commit/6910559daa6979f9ec9cf30bae3bda3eec039db0))
* **i18n:** every-page Vietnamese sweep, route discovery and docs (T224) ([6285e8c](https://github.com/quanghoangf/vibedoc/commit/6285e8c4163c1665e34b7d5a39564f2af731f820))
* **i18n:** language switch in Settings with the app shell in Vietnamese (T215) ([1a9383a](https://github.com/quanghoangf/vibedoc/commit/1a9383ad5f189420f386c6219159774d8566f8e4))
* **i18n:** memory and activity in Vietnamese (T220) ([a440432](https://github.com/quanghoangf/vibedoc/commit/a440432030afd129401b1f147b0a3519500e0a74))
* **i18n:** roadmap and doc link graph in Vietnamese (T218) ([7ea0c4c](https://github.com/quanghoangf/vibedoc/commit/7ea0c4c7bbc78533d58fdde446af43c2b64daeff))
* **i18n:** settings, help, shortcuts, command palette and shared UI in Vietnamese (T223) ([97c411f](https://github.com/quanghoangf/vibedoc/commit/97c411fa64605bfe9654b7cbd6a1c012bcc6fd4f))
* **i18n:** test review and evidence in Vietnamese (T221) ([141691b](https://github.com/quanghoangf/vibedoc/commit/141691b6512a337385424103bd1ff0cc3f1c1b09))
* **test-review:** auto-pause at each step with a step caption in the run player (T226) ([90aa8da](https://github.com/quanghoangf/vibedoc/commit/90aa8dadec72bf89599f7f06556477ae862fc2ae))
* **test-review:** playback speed in the run player, remembered per browser (T225) ([931deaf](https://github.com/quanghoangf/vibedoc/commit/931deafe12e5c7c74980d521915692699d208733))
* **testing:** cursor, highlight and action titles in presentation recordings (T228) ([3ae1dae](https://github.com/quanghoangf/vibedoc/commit/3ae1dae21b976beeba170995874223feb48c5feb))
* **testing:** presentation recording switch in the test kit, recorded in run.json (T227) ([3dba2a6](https://github.com/quanghoangf/vibedoc/commit/3dba2a6a0046000466e517986ca6c011d133161a))
* **testing:** step chapter cards and a hold after each step in presentation recordings (T229) ([6e6d277](https://github.com/quanghoangf/vibedoc/commit/6e6d2771a840c3300b97c19151a1083d01cad7fa))

# [1.15.0](https://github.com/quanghoangf/vibedoc/compare/v1.14.0...v1.15.0) (2026-10-06)


### Bug Fixes

* **package:** publish plugin/ instead of the removed skills/ folder ([6064b46](https://github.com/quanghoangf/vibedoc/commit/6064b4647a40f3114013ffe01d3dbe1140bf6ade))
* **run:** a stopped Run cleans half-written run folders of any task in the project ([ff55db6](https://github.com/quanghoangf/vibedoc/commit/ff55db60f1747a5974d249b4b825318c25d8f54d))
* **run:** Stop kills the run with retries on, and a late POST response can't undo a newer SSE state ([47fe667](https://github.com/quanghoangf/vibedoc/commit/47fe66750fe8821f3d439eb990893cd61724c2d3))
* **run:** the live Run strip shows on the Evidence view too ([61228df](https://github.com/quanghoangf/vibedoc/commit/61228df004c7fd5b2905921bf234018d494df426))
* **self-fix:** evidence.ts needs no review.ts import, so the test kit type-checks ([e24a5e8](https://github.com/quanghoangf/vibedoc/commit/e24a5e8bde71a814f5b29ea037c660458ab7b039))


### Features

* **evidence:** verdict, run recovery and quieter prose in the Evidence view ([4c4846c](https://github.com/quanghoangf/vibedoc/commit/4c4846cd961cd41d5c69a909f17b488e5f95a941))
* **flaky:** flaky shown in amber, its own tab, never counted as broken (T177) ([201d90b](https://github.com/quanghoangf/vibedoc/commit/201d90b9c5543d802d8fd30ed84f191ca369fbbf))
* **flaky:** Playwright retries, flaky outcome in run.json, run state and the Auto header (T176) ([fa9ecb0](https://github.com/quanghoangf/vibedoc/commit/fa9ecb0066f1a49cf6618fc1d0e9ff3bee7cbb1f))
* **help:** Help panel in the bottom-right corner with per-page keys and tips; drop the kbd strips on records ([502a4e6](https://github.com/quanghoangf/vibedoc/commit/502a4e607725a560fe8f1f57f0087c40e4a4c3cc))
* **honesty:** blank-app check after a passing Run, honesty.json per run (T168) ([c421469](https://github.com/quanghoangf/vibedoc/commit/c4214695718116119b99df111ef2e4c4975fb969))
* **honesty:** count assertions per step, flag steps with none or only trivial ones (T167) ([c931515](https://github.com/quanghoangf/vibedoc/commit/c931515ebb183712f20de56350e136b947f06f01))
* **honesty:** unverified chips in Evidence, the checklist and the Run strip; sent back as marks (T170) ([cae1b62](https://github.com/quanghoangf/vibedoc/commit/cae1b624939ee4a880c9e5a6c1cb1ae91cec05bb))
* **honesty:** unverified steps never count as proven: ticks, Auto header, Needs you (T169) ([53974a8](https://github.com/quanghoangf/vibedoc/commit/53974a8d3409e089e601ef4d564eeb5e51dcd694))
* **plugin:** ship the skills as the vibedoc Claude Code plugin (/vibedoc:roadmap, breakdown, work, next) ([7ea0daa](https://github.com/quanghoangf/vibedoc/commit/7ea0daa2d545ef459a1edd82ca40671311b22092))
* **release:** Homebrew tap updated by every release, Homebrew install tab and per-channel docs (T209) ([cd259bd](https://github.com/quanghoangf/vibedoc/commit/cd259bdcaa087e232678f0eb56088b48e41dc896))
* **review:** an agent's done with checks left lands in review; such reviews don't hold back dependents ([02765ac](https://github.com/quanghoangf/vibedoc/commit/02765ac29fff70b0847305fae74abbf3a8a572ef))
* **review:** approve or send back from the Evidence view, review tasks open on it (T163) ([3b4c5f5](https://github.com/quanghoangf/vibedoc/commit/3b4c5f56d8f1b5974a1f7ee03083cb26f0f9544a))
* **review:** flag doubtful steps in the Evidence view, send back lists them (T165) ([c2d2b43](https://github.com/quanghoangf/vibedoc/commit/c2d2b4397b7f52346b8401517bdd357e4eec5e62))
* **review:** flagged steps and the reviewed run in the ## Review entry (T164) ([842c274](https://github.com/quanghoangf/vibedoc/commit/842c274300908b491bb25e20a79bb828e5d33540))
* **review:** flagged-step count and run result chips on board cards (T166) ([5879a30](https://github.com/quanghoangf/vibedoc/commit/5879a30b40e49a7702be293e7828fd54f7f46704))
* **run:** fixture kit in the app's test dir, /work-epic specs record through it (T158) ([ae1cda6](https://github.com/quanghoangf/vibedoc/commit/ae1cda6931664fdd952d38b8d68be17c583c4c2b))
* **run:** run a task's spec from the server with live step events (T157) ([9d16af4](https://github.com/quanghoangf/vibedoc/commit/9d16af4b5a32a5bd9be07cd8411df50553e8e1bd))
* **run:** Run tests from the task panel and the board card (T161) ([47ff91e](https://github.com/quanghoangf/vibedoc/commit/47ff91e0b2dc0e8657a5c359ab98386fc14a2f8d))
* **run:** Run tests with live step progress on Test review (T159) ([0e609dc](https://github.com/quanghoangf/vibedoc/commit/0e609dc54395c5fb17459ef01ab46bae42a6a6e7))
* **run:** write a Run's result into the task's checklist (T160) ([f604c64](https://github.com/quanghoangf/vibedoc/commit/f604c64b71ed70d40beb94c0e33e8d77db1c50ea))
* **scenarios:** breakdown plans take covers and seed each task's Manual tests from its scenarios (T191) ([b847621](https://github.com/quanghoangf/vibedoc/commit/b8476215e21784eee46dc126ca5f51c3262521bb))
* **scenarios:** coverage check on the plan card and uncovered-scenario drift on the roadmap (T192) ([c07f8f3](https://github.com/quanghoangf/vibedoc/commit/c07f8f30f9150148c3b784d6cf37bdf941fada19))
* **scenarios:** epic ## Scenarios and task Covers, on the epic sheet and task panel (T190) ([1bb4737](https://github.com/quanghoangf/vibedoc/commit/1bb473702dca58fe2d7c5e4b78b0b4974f75b256))
* **scenarios:** scenario passed/failed/unproven on the epic sheet and get_roadmap, e2e and docs (T193) ([fed67a5](https://github.com/quanghoangf/vibedoc/commit/fed67a53450f37d9ce47d1abf09d88ab4c36859b))
* **self-fix:** a failed Run sends the task back with its failed steps (T178) ([eb35d5c](https://github.com/quanghoangf/vibedoc/commit/eb35d5c24d55ebc3863eaa2f4a714e52d9cec8e1))
* **self-fix:** cap automatic fixes, then a failed Run goes to a human (T179) ([390e3d6](https://github.com/quanghoangf/vibedoc/commit/390e3d6725c2f9f4cdb0d54d9e47315e313a453b))
* **self-fix:** suite failures go back like single Runs, flaky suite tasks, e2e proof and docs (T180) ([8122037](https://github.com/quanghoangf/vibedoc/commit/81220374d7c7d6b61810ba3321588b8acec8c49a))
* **site:** board shot, the loop and the feature tour with real screenshots (T203) ([3578025](https://github.com/quanghoangf/vibedoc/commit/3578025dc24a3773695f1bc4b4041b42e3113958))
* **site:** changelog page generated from CHANGELOG.md, linked from the site, docs and GitHub releases (T212) ([934a7fc](https://github.com/quanghoangf/vibedoc/commit/934a7fc47e9c7a796d4768ffccf9eb0766a48d14))
* **site:** cookie-free GoatCounter analytics with install-copy, demo and GitHub events (T214) ([ebebd3c](https://github.com/quanghoangf/vibedoc/commit/ebebd3ceb3161fe7ed74a17c77e5b4d7d4f3de5d))
* **site:** demo band with the recorded clip, poster and captions (T204) ([d944846](https://github.com/quanghoangf/vibedoc/commit/d9448468b15dd91fb3ada6cd180a6d2ee08c4c2c))
* **site:** install tabs (npx, npm, pnpm, bun) and the three install steps (T202) ([87f86a8](https://github.com/quanghoangf/vibedoc/commit/87f86a85ecfa13c1df24aac65d20b3f122d019fa))
* **site:** install with your AI assistant prompt on the landing page and in the docs (T211) ([773f82b](https://github.com/quanghoangf/vibedoc/commit/773f82bf169f0297cdb712458153201b1bf17a02))
* **site:** landing page skeleton (Astro + Tailwind 4) with header, hero and Pages deploy (T201) ([52de290](https://github.com/quanghoangf/vibedoc/commit/52de290ddd7d5fdd72864537967cc1af94c34f51))
* **site:** live star count, closing call to action, footer, social preview and SEO; link the site from README and npm (T206) ([f085b46](https://github.com/quanghoangf/vibedoc/commit/f085b46493aa8cb877d535dcf2263fa1f24de5ca))
* **site:** one-line installers for macOS, Linux and Windows that bring their own Node (T213) ([4c53f60](https://github.com/quanghoangf/vibedoc/commit/4c53f60ea9beed98beeb1e7282b9701fb6ff6f26))
* **site:** scroll-driven 'Watch a task move' sequence and supporting motion ([ad7ce57](https://github.com/quanghoangf/vibedoc/commit/ad7ce5785639f4f2207bf080b6c1cb5c49d5adb7))
* **site:** spec-driven development section (T208) ([0f1b114](https://github.com/quanghoangf/vibedoc/commit/0f1b1144382f66340e8c94255add67ef11bbe7a9))
* **site:** Starlight docs site with guides, concepts and a generated page per MCP tool (T210) ([1a88dfe](https://github.com/quanghoangf/vibedoc/commit/1a88dfeb05d976888aeaff543d939faa560ddfa4))
* **specs:** ## Spec changes on epics and a pure applyDelta (T194) ([e3a90a4](https://github.com/quanghoangf/vibedoc/commit/e3a90a4bcb6658d2d117d8af8be0890828fac31c))
* **specs:** capability spec parser, 'spec' doc kind in /docs and /graph, template (T181) ([d98d8a8](https://github.com/quanghoangf/vibedoc/commit/d98d8a8fa6d8f36c3a43234f9ef2eeb8699a6131))
* **specs:** memory capability spec, Specs on the memory epics, e2e and docs (T185) ([845fd5f](https://github.com/quanghoangf/vibedoc/commit/845fd5f8a2a6b880b2b13c412d4e9f64aa1ed697))
* **specs:** merge a done epic's spec changes into the capability spec from its sheet (T195) ([14267d3](https://github.com/quanghoangf/vibedoc/commit/14267d3d4ed7004eb338d544a72af719d28d8f48))
* **specs:** related capability spec on vibedoc_get_task and vibedoc_next_task (T182) ([add5da4](https://github.com/quanghoangf/vibedoc/commit/add5da44e00551ff04304ad01a20563cfd095649))
* **specs:** spec-unmerged and spec-conflict drift on the roadmap (T196) ([e5936ba](https://github.com/quanghoangf/vibedoc/commit/e5936ba0ced0a53ebd6691ebd267ed22d64a9e68))
* **specs:** vibedoc_list_specs, vibedoc_get_spec and the epic specs param (T183) ([ebe930f](https://github.com/quanghoangf/vibedoc/commit/ebe930f5859cb31b11f2cb630b7a99ecce973ad2))
* **specs:** vibedoc_spec_context gathers a capability's history to draft its spec (T184) ([f72a6b0](https://github.com/quanghoangf/vibedoc/commit/f72a6b0796f62d34be9c858604fb6c79d34dcd00))
* **suite:** one Playwright process records each spec under its task (T172) ([b73e87f](https://github.com/quanghoangf/vibedoc/commit/b73e87f4f5c0f4445890d2db0a7e58a52b575a68))
* **suite:** run every done task's spec in one Playwright run, per-task results (T173) ([2c9e4a4](https://github.com/quanghoangf/vibedoc/commit/2c9e4a433e4a9361c5fcdb7a8fe82e05eb41917c))
* **suite:** Suite tab on /manual-tests with live rows and broken tasks first (T174) ([3b0a50c](https://github.com/quanghoangf/vibedoc/commit/3b0a50c0a43e4b6be10f13b2e20e0e1a75d3fa84))
* **test-review:** priority, owner and updated time on rows; sort by priority or recently updated ([c0c3be7](https://github.com/quanghoangf/vibedoc/commit/c0c3be79d8b3f5678af94fbf71d7d236b05b38d3))
* **verify:** send back picked findings; findings outdated after newer task commits (T188) ([0fe4c18](https://github.com/quanghoangf/vibedoc/commit/0fe4c18e27867e8a714004094102e74678a57856))
* **verify:** verification findings section, vibedoc_report_findings, task panel and card badge (T186) ([0df85cb](https://github.com/quanghoangf/vibedoc/commit/0df85cb440ebe9ba4d7678ed7c082541bbc5fc56))
* **verify:** vibedoc_verify_context and the Verify button on review tasks (T187) ([a299ca2](https://github.com/quanghoangf/vibedoc/commit/a299ca268c6aeb9742fe616192f78f49b16434aa))

# [1.14.0](https://github.com/quanghoangf/vibedoc/compare/v1.13.0...v1.14.0) (2026-10-05)


### Features

* **evidence:** evidence API and vibedoc_get_evidence MCP tool (T154) ([099c654](https://github.com/quanghoangf/vibedoc/commit/099c6541b24501ecf5928a725b4d3e7921f35bf8))
* **evidence:** evidence formatter and EVIDENCE.md written after each run (T153) ([8549bfb](https://github.com/quanghoangf/vibedoc/commit/8549bfb0aa3281722c3e658862c0e4dfbf03dbe1))
* **evidence:** Evidence view with run history on Test review (T155) ([1fb74a1](https://github.com/quanghoangf/vibedoc/commit/1fb74a1bde3086aaf76848dc2c1e62640fc963ef))
* **evidence:** open evidence from the card badge and the task panel, e2e and docs (T156) ([dbcb174](https://github.com/quanghoangf/vibedoc/commit/dbcb174ac5420c3a1839d97ee8cb07307462a01c))
* **frontend:** detect the project's web frontend and show it on Settings (T138) ([ae67556](https://github.com/quanghoangf/vibedoc/commit/ae67556fa0e720225f5fba415fdf8d9c5bec8825))
* **frontend:** dev server lifecycle, reuse if up else spawn (T142) ([b793951](https://github.com/quanghoangf/vibedoc/commit/b7939517084316da58a60733645ab44d18c4fac3))
* **frontend:** log in once in a headed browser and save the session (T143) ([b23bae0](https://github.com/quanghoangf/vibedoc/commit/b23bae027c23ef867af44def2432b16b6ff21bc9))
* **frontend:** monorepo detection and settings override (T139) ([285e27e](https://github.com/quanghoangf/vibedoc/commit/285e27e29f579bfa3d41f6844ff7356d29c37510))
* **frontend:** Playwright check and one-click install on Settings (T141) ([c1cf5cd](https://github.com/quanghoangf/vibedoc/commit/c1cf5cd8711853bee89a813832000ebeb0ee1d9b))
* **frontend:** smoke test, e2e check and docs (T144) ([700c9b3](https://github.com/quanghoangf/vibedoc/commit/700c9b32e1c9ee4b45b2bd1aed143e3c7ef57c53))
* **manual-tests:** automated items, spec link and last run in the checklist header (T145) ([f66091b](https://github.com/quanghoangf/vibedoc/commit/f66091bdbca741f39613a571cb0c73b843060b57))
* **manual-tests:** show automated vs manual items on card, panel and /manual-tests (T146) ([4e589c7](https://github.com/quanghoangf/vibedoc/commit/4e589c70be9dee977b039455fee4868ba0445f2f))
* **manual-tests:** Test review page with run replay, multi-select and bulk actions ([44fb21d](https://github.com/quanghoangf/vibedoc/commit/44fb21d9f4e7a625618b0e894badab74e9aab89b))
* **mcp:** vibedoc_get_frontend tool and Frontend status line (T140) ([9d8f425](https://github.com/quanghoangf/vibedoc/commit/9d8f4250de70252d9a8f717bd956a321356bf720))
* **playwright:** capture fixture with step screenshots, run video and run.json (T149) ([fc75dbb](https://github.com/quanghoangf/vibedoc/commit/fc75dbb22680babf37c4598f3b40bf27ea981500))
* **playwright:** keep only the newest N finished runs per task (T150) ([810f423](https://github.com/quanghoangf/vibedoc/commit/810f42305aaa1f070d04ff56d8f763452c1271b7))
* **runs:** list a task's runs and serve their screenshots and video with Range (T151) ([dfc23c9](https://github.com/quanghoangf/vibedoc/commit/dfc23c9472cdc6d3f018ad85654b3992530c2628))
* **runs:** show a task's runs with step screenshots and video in the task panel (T152) ([ecb7a07](https://github.com/quanghoangf/vibedoc/commit/ecb7a073ce09007be92a569661f573acd3f719fb))
* **work-epic:** run the spec before done, fail to review with the spec named on claim (T148) ([c126078](https://github.com/quanghoangf/vibedoc/commit/c126078b657ab4615e02dcb889d9947c1c35dbdd))
* **work-epic:** write a Playwright spec from the checklist for UI tasks (T147) ([6fa698a](https://github.com/quanghoangf/vibedoc/commit/6fa698ad931da14643aaf64133c4dae39fd106bf))

# [1.13.0](https://github.com/quanghoangf/vibedoc/compare/v1.12.0...v1.13.0) (2026-10-04)


### Features

* **activity:** action badges, filters, clickable targets, less noise ([6650a6c](https://github.com/quanghoangf/vibedoc/commit/6650a6c9329e704c1be93d900bcda5a8080f3ff1))
* **cli:** vibedoc --version / -v (T136) ([0054ca6](https://github.com/quanghoangf/vibedoc/commit/0054ca6f8570d28d27a2a31d64226dc86a8f163d))
* **demo:** example project and Docker/Fly demo deploy config (T133) ([a3e44fb](https://github.com/quanghoangf/vibedoc/commit/a3e44fbf35da7e19614d0f047194540eda67e839))
* **demo:** VIBEDOC_DEMO=1 read-only demo mode (T132) ([64ce61c](https://github.com/quanghoangf/vibedoc/commit/64ce61c458edc70ae46c1624f7918dff376ae700))
* **docs:** /welcome landing page and /getting-started guide (T134) ([6e963d2](https://github.com/quanghoangf/vibedoc/commit/6e963d22cfef2f00f70d3bb96ad7c178a9c0d7cb))
* **memory:** import Claude Code memory and export entries to AGENTS.md (R052) ([7f12a94](https://github.com/quanghoangf/vibedoc/commit/7f12a949b3b668ae4ba9a436f92e6fbde34f8a8f))
* **ui:** show the VibeDoc version in the sidebar header (T137) ([99d2023](https://github.com/quanghoangf/vibedoc/commit/99d2023fe3286730aa921fbc6d8b71d9d00f1dac))

# [1.12.0](https://github.com/quanghoangf/vibedoc/compare/v1.11.0...v1.12.0) (2026-10-03)


### Bug Fixes

* **memory:** CRLF-safe section insert, case-insensitive handoff excerpt, issues schema accepts objects; tool count docs ([e4e91d1](https://github.com/quanghoangf/vibedoc/commit/e4e91d112954c08044a944bce7379fef923bbcae))
* **memory:** demote headings in passed values, CRLF-safe merge, fence-aware stamp ([6dd3f10](https://github.com/quanghoangf/vibedoc/commit/6dd3f105e6bfed862b3850c70a0fd6b16936d713))
* **memory:** detect identical history version from diff lines, not hunk count ([5f894bd](https://github.com/quanghoangf/vibedoc/commit/5f894bdbd0bfa3edf1f5ea4b9ba048ae31061774))
* **memory:** normalize actor to ai|human before snapshotting MEMORY.md ([14dc6ff](https://github.com/quanghoangf/vibedoc/commit/14dc6ffca20075896e22a9ab92c84585573146df))


### Features

* **mcp:** vibedoc_memory_history lists, reads and restores MEMORY.md versions ([f370339](https://github.com/quanghoangf/vibedoc/commit/f37033924eb6aef7e89cf3a28b127c69b9edb340))
* **memory:** MEMORY.md version history with diff, restore and undo on /memory ([8f27583](https://github.com/quanghoangf/vibedoc/commit/8f275836d4bfcca62de4b6596db246c470e6b6d7))
* **memory:** merge sections in vibedoc_update_memory instead of rewriting MEMORY.md ([b63f776](https://github.com/quanghoangf/vibedoc/commit/b63f77665e81733f0894ab15fb9d6daf646b708e))
* **memory:** snapshot MEMORY.md before each write and restore saved versions ([da0878f](https://github.com/quanghoangf/vibedoc/commit/da0878f9695e0546e4d35355ee3509517eef1986))

# [1.11.0](https://github.com/quanghoangf/vibedoc/compare/v1.10.0...v1.11.0) (2026-10-03)


### Bug Fixes

* **chat:** route an epic's ask to its own chat, never into another item's or a waiting one ([1c08398](https://github.com/quanghoangf/vibedoc/commit/1c08398c623da2be4f3f669d5e31400fcef55c5d))
* **docs:** backticked glob patterns are not links ([0c93f01](https://github.com/quanghoangf/vibedoc/commit/0c93f01dd0985ca92834b2fa20036578fcbef1a7))
* **docs:** resolve titled, encoded, id wikilinks; skip ~~~ and inline code ([091233d](https://github.com/quanghoangf/vibedoc/commit/091233d7cbdf35215d160b13e8ab280826bc9831))
* **graph:** keep the link cache fresh across pages and colour status dots like their chips ([f3d41d3](https://github.com/quanghoangf/vibedoc/commit/f3d41d3a2488b0184fc26f53d5c110e3b44338fa))
* **graph:** readable labels at fit, label-first search, column-side preview, accent-edge selection ([67dff84](https://github.com/quanghoangf/vibedoc/commit/67dff84cab9bc408651f000a574ea6904bff8009))
* **graph:** solid accent line instead of the edge glow; CSS unfold entrance without per-frame renders ([54f8a64](https://github.com/quanghoangf/vibedoc/commit/54f8a6432f185e8590b0dfd1304d0bea58f2493e))
* **graph:** T108 search cursor resets with the matches, framing keeps the 0.5 floor, neighbour labels hold when zoomed out ([8cad818](https://github.com/quanghoangf/vibedoc/commit/8cad8182e96c26446f95a2c65c9c7cbdce307449))
* **graph:** T109 narrow syntax-example rule, dot-folder links not drawn dead, Show all keeps keyboard focus, full broken-links label from lg ([a90f378](https://github.com/quanghoangf/vibedoc/commit/a90f378703b3325842e36d15e99eaf7efaea7993))
* **graph:** T109 self-check cases for placeholders, [@includes](https://github.com/includes), bare names, dot-folder files and syntax examples ([e326d89](https://github.com/quanghoangf/vibedoc/commit/e326d890e280120472c06325faa9f27069476d41))
* **graph:** T109 trustworthy broken and stale counts — skip placeholders and syntax examples, resolve [@includes](https://github.com/includes), unique bare names and dot-folder files; /graph toolbar shows broken links only ([68127da](https://github.com/quanghoangf/vibedoc/commit/68127dac4582fef3775bccc10c4d570f2487038f))
* **graph:** T110 keyboard-selected node keeps the hairline under focus; new tasks log activity so Recent sees them ([d5d766f](https://github.com/quanghoangf/vibedoc/commit/d5d766f1d0d0bb932cb95ef2f55cc17b67953d84))
* **graph:** T111 selected edge clears 3:1 for every accent, epic status in entry Related, no 0 counts on a failed load ([8b40017](https://github.com/quanghoangf/vibedoc/commit/8b40017e11f68d13f7d80b85345ef183cd22a124))
* **graph:** T112 Fit reuses the mount fit's camera, so the first Fit starts no label pass under the entrance ([5415e38](https://github.com/quanghoangf/vibedoc/commit/5415e385760a6f4691caed29d4b44b5cd4cef850))
* **memory:** episodes cover work done after a session's handoff ([4ebeaa6](https://github.com/quanghoangf/vibedoc/commit/4ebeaa62abfeaebb25ebd01f03f6d14375b78e69))
* **memory:** ignore ids in code, prune dismissals of gone entries, flag dangling entry ids ([81ce8a5](https://github.com/quanghoangf/vibedoc/commit/81ce8a548b14ee2a91c6a05d43a12cca45c71d99))
* **memory:** T113 label entry saves and merge chat sources in a session episode ([a4e0594](https://github.com/quanghoangf/vibedoc/commit/a4e0594a7675f0f8c6156b6f7efc0bc49113741f))
* **memory:** T115 never backfill a session another client's read_memory interrupts ([b20d705](https://github.com/quanghoangf/vibedoc/commit/b20d7050f611231d43aa0af688bc078f7a9c2158))
* **memory:** T117 ignore headings inside code fences when splitting handoff sections ([8126b86](https://github.com/quanghoangf/vibedoc/commit/8126b860d0e4d720abc05a7f03c2e6f91285070c))
* **memory:** T118 serialize cleanup dismisses and show IDs in flag messages in mono ([6ad1c93](https://github.com/quanghoangf/vibedoc/commit/6ad1c93a95a47d968466975144860f26cb757e12))
* **memory:** T119 tokenize each entry once in duplicate detection ([ac5a164](https://github.com/quanghoangf/vibedoc/commit/ac5a16470c16c9513d6f9658dd69423508a636ab))
* **memory:** T120 return focus to Merge… when the merge dialog closes ([73a0aec](https://github.com/quanghoangf/vibedoc/commit/73a0aec2a3addc1a3f7259c36bbab45cfa183d54))
* **memory:** T121 prune merged ids from the recall log and keep focus after a row action ([b3e1169](https://github.com/quanghoangf/vibedoc/commit/b3e116989651fe958093d28427cca19d5fe0d366))
* **memory:** T122 add the warnings step to the in-app CLAUDE.md template ([85c3dc8](https://github.com/quanghoangf/vibedoc/commit/85c3dc884a443ffd18f7c1afe76f1e48af5d8b21))


### Features

* **docs:** clickable .md links and [[wikilinks]] in the doc preview ([537ba6b](https://github.com/quanghoangf/vibedoc/commit/537ba6b734e2039a24904a14f657c4a326b32706))
* **docs:** hover preview card for doc links and linked docs rows ([fa42424](https://github.com/quanghoangf/vibedoc/commit/fa42424a22bb833ad32b517f1376ae1a20ec876c))
* **docs:** linked docs panel with links to, linked from and broken links ([a50e2c1](https://github.com/quanghoangf/vibedoc/commit/a50e2c15c9a167e202a8ab0ecf3e9dd8def5dad4))
* **docs:** readable link previews with status chips, sentence citations and unique link counts ([a81626a](https://github.com/quanghoangf/vibedoc/commit/a81626a69d1d935ff2137566faee648d5a32d51f))
* **docs:** resolved doc link graph with links and graph API ([79803bc](https://github.com/quanghoangf/vibedoc/commit/79803bc527ba847d8a6b26c2c591a1c944414067))
* **graph:** /graph page with the whole-repo doc link graph ([cc5fbc6](https://github.com/quanghoangf/vibedoc/commit/cc5fbc6997af45eec38f8668f940fe0ab9fc6316))
* **graph:** deterministic force layout for the doc graph ([135e63b](https://github.com/quanghoangf/vibedoc/commit/135e63b6af096b33ac8d77914d6f9728389e14cc))
* **graph:** final polish pass, keyboard and live-update e2e, Doc Link Graph in DESIGN.md ([7d34ab8](https://github.com/quanghoangf/vibedoc/commit/7d34ab8e726e666ded8b646cb7c34c8a04070a5a))
* **graph:** keep the camera on live updates, one fetch per burst, error state ([544041a](https://github.com/quanghoangf/vibedoc/commit/544041a505d8b8efa998cb31f29fb6c92dacdc12))
* **graph:** keyboard path and screen reader names for /graph ([6045322](https://github.com/quanghoangf/vibedoc/commit/6045322c8afa5ae71adac6443e4bb447bf37ab39))
* **graph:** living map motion — settle entrance, drag physics, edge flow, hover magnet and live ping ([3bc4718](https://github.com/quanghoangf/vibedoc/commit/3bc47184b6f75b900dcda21f0be98c87cbf453ce))
* **graph:** readable at the fitted zoom — px-gated labels, unlinked shelf, search framing and cycling, 24px hit pads ([2076124](https://github.com/quanghoangf/vibedoc/commit/2076124f8b4461a765c41d539448129dfd3c91c2))
* **graph:** relayout glides with the camera, selection ripples, live changes flash ([656c10f](https://github.com/quanghoangf/vibedoc/commit/656c10f2f29bc1eaf516869b968265cdcc31cd81))
* **graph:** split broken links from stale path mentions, list both and jump to the line ([f4d5662](https://github.com/quanghoangf/vibedoc/commit/f4d5662b46f3d083afdbf627cd30368da694c5cd))
* **graph:** status-aware shapes and colours, visible link counts, label collisions ([4f93492](https://github.com/quanghoangf/vibedoc/commit/4f93492e8c14790e3c03cc2f67ed1125638c7b3e))
* **graph:** T110 colour marks what needs you — done hollow grey, Recent notch and chip, hue-independent selection ring, light-theme teal token ([0302b70](https://github.com/quanghoangf/vibedoc/commit/0302b706ad0c02101f12571a6202030f072a5fd7))
* **graph:** T111 visible keyboard model and one link UI — key strip, ? Graph section, Show in graph, epic status icons, muted broken count, Tab-safe preview, menu focus edge ([ae81177](https://github.com/quanghoangf/vibedoc/commit/ae811770efb4ef50165cb7d8b4d7fdd610ba091c))
* **graph:** T112 entrance without a re-render, phone bottom-sheet card, hover yields to focus, files vs docs count ([0637012](https://github.com/quanghoangf/vibedoc/commit/06370122ddec95800ef32ea121332b3d201efc0b))
* **mcp:** vibedoc_read_doc ends with resolved related files ([a7328f5](https://github.com/quanghoangf/vibedoc/commit/a7328f52c3232af74aefec27ba8a40e7cee134f5))
* **memory:** cleanup panel on the Memory tab with dismissable health flags ([3c7f488](https://github.com/quanghoangf/vibedoc/commit/3c7f488e2e1318e8ae7a24f21f2eccead3c3d645))
* **memory:** episodes at epic-run end and lazy backfill for ended sessions ([6350ed8](https://github.com/quanghoangf/vibedoc/commit/6350ed84f39d01597bb5ce47b0a6796c6c40e19c))
* **memory:** start the next session from the latest episode newer than MEMORY.md ([eacabe4](https://github.com/quanghoangf/vibedoc/commit/eacabe448729d1f5d4184f5ddd1823d3d66c958b))
* **memory:** T119 flag duplicate knowledge entries in the Cleanup panel ([d284a80](https://github.com/quanghoangf/vibedoc/commit/d284a8082de8b20d738639ede1082c94083b5b85))
* **memory:** T120 approve a suggested merge into one entry, with Undo ([264bb8c](https://github.com/quanghoangf/vibedoc/commit/264bb8c9a93a039bdc35e36963be49c068112e97))
* **memory:** T121 recall log and "Not recalled lately" cleanup flags ([2ca3c3d](https://github.com/quanghoangf/vibedoc/commit/2ca3c3d04b0db8fd42d112610b382e8d0119fd31))
* **memory:** warn in vibedoc_read_memory when the handoff contradicts the board ([2153e41](https://github.com/quanghoangf/vibedoc/commit/2153e4146f68ee24d95e4deb611ad55b880735db))
* **memory:** write a session episode when a chat turn ends without a handoff ([063a142](https://github.com/quanghoangf/vibedoc/commit/063a1427e0502e6c538457bc81c3f8bf40daa772))

# [1.10.0](https://github.com/quanghoangf/vibedoc/compare/v1.9.0...v1.10.0) (2026-09-30)


### Features

* **docs:** content-first reading pane, token editor theme, collapsible docs list ([d346899](https://github.com/quanghoangf/vibedoc/commit/d346899608b3e2790e98feb3c75046947a649ed5))
* **roadmap:** Arrange button to tidy the map ([1bcfba7](https://github.com/quanghoangf/vibedoc/commit/1bcfba77f139f4046f974e3160fc2d5dc9248a73))
* **ui:** P0-P3 priority and Notion-style properties for docs, tasks and epics ([818f3cf](https://github.com/quanghoangf/vibedoc/commit/818f3cfed50fa18de2a7c3e40af4251fe61ec03d))

# [1.9.0](https://github.com/quanghoangf/vibedoc/compare/v1.8.0...v1.9.0) (2026-09-30)


### Bug Fixes

* **chat:** chat agents can't delete knowledge entries ([57cd7c9](https://github.com/quanghoangf/vibedoc/commit/57cd7c9dec4de34dfcfc075509c4887e7a18c1f1))


### Features

* **memory:** delete a knowledge entry from /memory with Undo ([41015a8](https://github.com/quanghoangf/vibedoc/commit/41015a83617b38147139abe281cdf357516d98c5))
* **memory:** entry history from git on /memory ([a96dd3b](https://github.com/quanghoangf/vibedoc/commit/a96dd3b2f2cad1b987814bf1140c94c075e01b43))
* **memory:** graph view of entries and their links on /memory ([a4a94bf](https://github.com/quanghoangf/vibedoc/commit/a4a94bfba46f0be74f83f8e1bc085b6076bee89b))
* **memory:** knowledge entries list with search and type filter on /memory ([64dbcd0](https://github.com/quanghoangf/vibedoc/commit/64dbcd0f437296948728a47ecae17d4d2d6672d6))
* **memory:** knowledge entry files and vibedoc_save_entry ([a3b8279](https://github.com/quanghoangf/vibedoc/commit/a3b8279e2657481b99cc043e6cc581f1858d9e01))
* **memory:** link graph inferred from entry text; GET /api/memory/graph ([d63af35](https://github.com/quanghoangf/vibedoc/commit/d63af3549696f227db6e1bb0f39a35e24dc58d1f))
* **memory:** links and backlinks in vibedoc_get_entries ([c2aef6e](https://github.com/quanghoangf/vibedoc/commit/c2aef6ee11ed396f986dbd5d6a4cea716b4bcc89))
* **memory:** open, edit and add knowledge entries on /memory ([43595cf](https://github.com/quanghoangf/vibedoc/commit/43595cfe0d7dad9869f846255830ac350195dfdb))
* **memory:** Related panel on an entry — links to and linked from ([89a2b04](https://github.com/quanghoangf/vibedoc/commit/89a2b04e4fda9da3b2ff97097c3673331b20485f))
* **memory:** show who changed each knowledge entry; e2e for the Memory browser ([7abf6a0](https://github.com/quanghoangf/vibedoc/commit/7abf6a02366edaa76c5dac594d740e2048c7d6ff))
* **memory:** suggest related entries when a task is claimed or opened ([1f9228a](https://github.com/quanghoangf/vibedoc/commit/1f9228ac47c42e8922b08f7406d8fd1d17909fec))
* **memory:** token budget for the session-start entry index ([476f194](https://github.com/quanghoangf/vibedoc/commit/476f194c527e61ea68a1c83e000f7c01a29ccf4f))
* **memory:** vibedoc_delete_entry and the entry index at session start ([9fde28f](https://github.com/quanghoangf/vibedoc/commit/9fde28fac395d570168a80d684cdab72c8580b73))
* **memory:** vibedoc_get_entries — fetch full entries by id ([1b40c24](https://github.com/quanghoangf/vibedoc/commit/1b40c245e70ece5681e618947644af060904315c))
* **memory:** vibedoc_recall — compact ranked list of entries by keyword ([9fc9e41](https://github.com/quanghoangf/vibedoc/commit/9fc9e416cbe65d931b4fb93d07611eac513bf450))

# [1.8.0](https://github.com/quanghoangf/vibedoc/compare/v1.7.0...v1.8.0) (2026-09-30)


### Bug Fixes

* **core:** warn once per unknown status; coalesce doc edits across interleaved events ([3ee94c1](https://github.com/quanghoangf/vibedoc/commit/3ee94c10f09c6f24897d39f0921b8728eb3f4dd6))


### Features

* **board:** select tasks and change status, epic or delete them in bulk ([7c39745](https://github.com/quanghoangf/vibedoc/commit/7c39745474f31e5294e7d270c6cc1c61771003f5))
* **docs:** actions menu in the doc header and on right-click in the list ([a1bbbd1](https://github.com/quanghoangf/vibedoc/commit/a1bbbd1171fa532b510d3e9dd7ceeed01275333a))
* **roadmap:** actions menu on roadmap items (map, timeline, sheet) ([5db4746](https://github.com/quanghoangf/vibedoc/commit/5db474634b59b877720fb0a1deab183bbd9dc789))
* **tasks:** automatic due, started and done dates ([0e58941](https://github.com/quanghoangf/vibedoc/commit/0e58941978a0bcb4d847b83d8c463fa267b8aac7))
* **tasks:** custom statuses per project, mapped onto the built-in lifecycle ([a44304a](https://github.com/quanghoangf/vibedoc/commit/a44304a20734ef644717b767bd576459c0f21776))
* **tasks:** edit task fields and delete tasks from the panel and card ([1fe71ee](https://github.com/quanghoangf/vibedoc/commit/1fe71eec24ef50334ed11f4315db142490fb7416))
* **tasks:** manual test report on a task with a card badge ([7aec884](https://github.com/quanghoangf/vibedoc/commit/7aec884748fa47f231753936202d211a5f29052e))
* **tasks:** manual tests page to tick a task's checklist ([be34c8d](https://github.com/quanghoangf/vibedoc/commit/be34c8df754730a39be024c820529cff97ffc86c))
* **tasks:** optional Review column with approve / send back ([d14772e](https://github.com/quanghoangf/vibedoc/commit/d14772e3cb63853f73c00758526a71c82cc91da4))
* **tasks:** owner (human or agent) on tasks, epics and docs, with board filter and group ([b63777c](https://github.com/quanghoangf/vibedoc/commit/b63777cc22a0c2a8c3fde581d5dab4b452c98686))
* **tasks:** paused status for tasks and epics ([f8140b0](https://github.com/quanghoangf/vibedoc/commit/f8140b0773ef30017fa4c26571955d8d5d446649))
* **ui:** calmer app shell, one status icon system, compact board ([452b1b3](https://github.com/quanghoangf/vibedoc/commit/452b1b3281e13a51fb044b31ca9f5424c1cc7ec0))
* **ui:** edit status, owner, due and size in place ([4aeb892](https://github.com/quanghoangf/vibedoc/commit/4aeb892ceea8911bfbce4fa9189d5c0629e91996))
* **ui:** keyboard shortcuts and palette entries for item actions ([c2ed706](https://github.com/quanghoangf/vibedoc/commit/c2ed7060021294c6d4768b25afceb7a62da98755))
* **ui:** one panel header for tasks, epics and docs ([5493c30](https://github.com/quanghoangf/vibedoc/commit/5493c30aee7972b6d09745534018ddf98a8f55c4))
* **ui:** undo toast for deleting tasks, epics and docs ([f415009](https://github.com/quanghoangf/vibedoc/commit/f4150092dd542f5bf2d6676b0e81c16e242bc808))
* **work-epic:** write a manual test report per task; queue waits on review ([4371a19](https://github.com/quanghoangf/vibedoc/commit/4371a1930f3e1effdf5b8d1ec60e4a832b27f917))

# [1.7.0](https://github.com/quanghoangf/vibedoc/compare/v1.6.1...v1.7.0) (2026-09-29)


### Bug Fixes

* **chat:** never save a chat into the next project; stop re-rendering the map per stream delta ([dfe78b8](https://github.com/quanghoangf/vibedoc/commit/dfe78b8fef75f432292be7bdabc9fdcd351183de))


### Features

* **chat:** add tab status markers and close-to-stop ([f4f9834](https://github.com/quanghoangf/vibedoc/commit/f4f9834bef734a875fec8f90e45b8f8b49350666))
* **chat:** break down several epics at once from the roadmap ([55b9e79](https://github.com/quanghoangf/vibedoc/commit/55b9e79b2139bf825a3d24fb9c7e600d5ea35ac9))
* **chat:** chat modal, /chat page and sidebar agents with saved chats on epics and tasks ([4399e20](https://github.com/quanghoangf/vibedoc/commit/4399e20e0484df6f3ca04c7f8238bf376a5f53af))
* **chat:** run parallel agent chats as tabs ([b8a53d6](https://github.com/quanghoangf/vibedoc/commit/b8a53d6d2fb97837a336c4669a2d85552a746d6d))
* **chat:** tell the user when a chat is waiting on them ([4f04da4](https://github.com/quanghoangf/vibedoc/commit/4f04da4d209a2ba43d614d89f5e470c4f2d52f57))
* **roadmap:** show which epics an agent chat is working on ([89a0a34](https://github.com/quanghoangf/vibedoc/commit/89a0a341fbeab2eaab5c1411890b70fa57db1aef))

## [1.6.1](https://github.com/quanghoangf/vibedoc/compare/v1.6.0...v1.6.1) (2026-09-29)


### Bug Fixes

* **mcp:** show the real server address instead of localhost:3000 ([99e9731](https://github.com/quanghoangf/vibedoc/commit/99e9731eb7936507fdf68dca00e0505a0d1e997b))

# [1.6.0](https://github.com/quanghoangf/vibedoc/compare/v1.5.0...v1.6.0) (2026-09-29)


### Bug Fixes

* **build:** bundle glob so the published package runs outside the repo ([9614d18](https://github.com/quanghoangf/vibedoc/commit/9614d18e7afc8bfe83055d6373cccf2ad52eaf04))


### Features

* **docs:** break down a doc as a spec from the doc header ([7319501](https://github.com/quanghoangf/vibedoc/commit/7319501a34c55992d6889ed2e92ed230060255b7))
* **plan:** break a spec into tasks with a new epic or no epic ([ab83bb7](https://github.com/quanghoangf/vibedoc/commit/ab83bb7c6bcc8befcae737a144c5e491c997ad7d))
* **roadmap:** add plan from spec dialog that hands a pasted spec to the agent ([c7e896f](https://github.com/quanghoangf/vibedoc/commit/c7e896f7a56dd53f58de6f9b1bf9c010d892a5c0))
* **roadmap:** mission-control nodes with task segments, chapters and status edges ([2e73d9c](https://github.com/quanghoangf/vibedoc/commit/2e73d9cc5e425e17cba6678d447ad93c2a6be8b2))
* **roadmap:** read-first item sheet with progress, next task and rendered brief ([62f44a6](https://github.com/quanghoangf/vibedoc/commit/62f44a6923b73c2c69864e2b0b571861883c6b9a))
* **roadmap:** stats toolbar as legend and an attention menu ([010a978](https://github.com/quanghoangf/vibedoc/commit/010a978b774a575536c06e0487715e953f4badcf))
* **roadmap:** timeline lanes with chapters, progress and status chips ([d292012](https://github.com/quanghoangf/vibedoc/commit/d292012ea3dfa7821e94b74a2e405eff81e3cbde))

# [1.5.0](https://github.com/quanghoangf/vibedoc/compare/v1.4.1...v1.5.0) (2026-09-29)


### Features

* **activity:** group activity into sessions with GET /api/sessions ([e4e7138](https://github.com/quanghoangf/vibedoc/commit/e4e71387ec674f8e7187dd33c579201b13a9127a))
* **activity:** redesign session timeline with catch-up strip and motion ([a7ca639](https://github.com/quanghoangf/vibedoc/commit/a7ca639a55a854609d3db826f82ca6a338c6611d))
* **activity:** session timeline in the Activity tab ([52e7733](https://github.com/quanghoangf/vibedoc/commit/52e7733bc320a328e93b276ef3b75da73749e621))
* **board:** list a task's sessions in the task detail panel ([97bf515](https://github.com/quanghoangf/vibedoc/commit/97bf515190527d9148e2d7c6bf934ff7c234a06b))
* **chat:** add agent chat sidebar with reviewable partial doc edits ([2f28099](https://github.com/quanghoangf/vibedoc/commit/2f28099422457f20679a16b7dc5d0b5a445797ca))
* **chat:** plan roadmaps and break down epics from the chat sidebar ([09eb185](https://github.com/quanghoangf/vibedoc/commit/09eb1850bc0c1c81e010af1d0309b51b53ec1d07))
* **mcp:** add vibedoc_get_sessions tool ([64e8551](https://github.com/quanghoangf/vibedoc/commit/64e85510429b09b7b40f69d6c5133179c5c263e4))
* **mcp:** add vibedoc_next_task work queue and epic task list in roadmap ([f791470](https://github.com/quanghoangf/vibedoc/commit/f791470fd0f45233d84465c11185f1f8e6f44b98))
* **mcp:** tag at-risk epics in vibedoc_get_roadmap and document the rules ([bd4b99e](https://github.com/quanghoangf/vibedoc/commit/bd4b99e3cc6264005b3c54c9ec37e9f2a1a24768))
* **roadmap:** add brainstorm notes and @xyflow/react dependency ([cafc8a5](https://github.com/quanghoangf/vibedoc/commit/cafc8a519c405412cd0e1904ef92a4464f21403a))
* **roadmap:** add due dates and a timeline view ([e86f1c6](https://github.com/quanghoangf/vibedoc/commit/e86f1c6908459d5e6aff5a382912df9a0f507ef5))
* **roadmap:** add roadmap.sh-style roadmap page ([365f563](https://github.com/quanghoangf/vibedoc/commit/365f5633c925144d13cdfed8adaf005739aabc65))
* **roadmap:** flag at-risk epics on the map and in MCP ([27bceb0](https://github.com/quanghoangf/vibedoc/commit/27bceb0996b844d6970c84c370dc91481903a5b7))
* **roadmap:** generate a roadmap for projects that have none ([4e3ab11](https://github.com/quanghoangf/vibedoc/commit/4e3ab1198f85e14df052f9c398395f6ed9c15291))
* **roadmap:** show task due dates on epic nodes ([e0a465a](https://github.com/quanghoangf/vibedoc/commit/e0a465a091b628edfa06060f4c79beefa528fb99))
* **roadmap:** show task progress and drift warnings ([4dd2d83](https://github.com/quanghoangf/vibedoc/commit/4dd2d835dec617868710a6ae67f37ab9797725aa))
* **roadmap:** stub roadmap types and core API contract ([d05fada](https://github.com/quanghoangf/vibedoc/commit/d05fadaa251ca7a4a4020370bd9d792ab09bc17b))
* **roadmap:** weight horizon progress by tasks ([051cd15](https://github.com/quanghoangf/vibedoc/commit/051cd151dc14156ba5ac437a9adc3f10d1cca1bd))
* **skills:** add roadmap-planner and epic-breakdown skills ([2e6a7b9](https://github.com/quanghoangf/vibedoc/commit/2e6a7b9ddd0f0fddc47c35e1985e3a8e7747010d))
* **skills:** add what-next skill to recommend the next action ([6eabdc4](https://github.com/quanghoangf/vibedoc/commit/6eabdc439cdef3f55c80264bf7103610bec0e0bc))
* **ui:** smooth motion, theme tokens, font settings and docs quick open ([fff1643](https://github.com/quanghoangf/vibedoc/commit/fff16430a47af14af75294bb43d2d1a01190e379))

## [1.4.1](https://github.com/quanghoangf/vibedoc/compare/v1.4.0...v1.4.1) (2026-04-25)


### Bug Fixes

* guard against undefined board keys crashing empty-project setup ([e582730](https://github.com/quanghoangf/vibedoc/commit/e5827302646a60a1b669cf2ebfff9c0e5b4b124e))

# [1.4.0](https://github.com/quanghoangf/vibedoc/compare/v1.3.0...v1.4.0) (2026-04-11)


### Features

* settings wiring, task creation UI, explorer filters, error boundaries, README polish ([6f48fc2](https://github.com/quanghoangf/vibedoc/commit/6f48fc2b2b2633cb0197735a6e18dfd3cdab417f))

# [1.3.0](https://github.com/quanghoangf/vibedoc/compare/v1.2.1...v1.3.0) (2026-04-11)


### Bug Fixes

* rebuild .next for npm publish and ignore auto-generated REGISTRY.md ([ad25f9a](https://github.com/quanghoangf/vibedoc/commit/ad25f9a44af230b75a68376497e84678bec5fc36))
* write .env.local before next start to guarantee VIBEDOC_ROOT reaches server ([c43f2cf](https://github.com/quanghoangf/vibedoc/commit/c43f2cf4a31411a76034567847ca932991c0eb7e))


### Features

* add document registry (docs/REGISTRY.md) with MCP tools ([1911d88](https://github.com/quanghoangf/vibedoc/commit/1911d88e035b10d0b26631cebff0cb79233f4fce))

## [1.2.1](https://github.com/quanghoangf/vibedoc/compare/v1.2.0...v1.2.1) (2026-04-02)


### Bug Fixes

* pass VIBEDOC_ROOT env var to Next.js server in vibedoc.mjs ([0e530a5](https://github.com/quanghoangf/vibedoc/commit/0e530a5f8e2a3d5ac041aa6f8a21fdff54060b0f))

# [1.2.0](https://github.com/quanghoangf/vibedoc/compare/v1.1.0...v1.2.0) (2026-04-02)


### Bug Fixes

* enable treemap drill-down with leafDepth: 1 ([cabf5df](https://github.com/quanghoangf/vibedoc/commit/cabf5dfda31ad0353e29a2fc39b3ea6df853c1d1))
* normalize backslash paths + redesign treemap colors and typography ([d239ac4](https://github.com/quanghoangf/vibedoc/commit/d239ac4ce5bd5438bd29badbe34415741a693ff8))
* treemap null guard and folder value summation ([6a1d7b0](https://github.com/quanghoangf/vibedoc/commit/6a1d7b051477db4a813607fe4bf6730be92d2750))


### Features

* replace Cards view with ECharts treemap in Explorer ([434a628](https://github.com/quanghoangf/vibedoc/commit/434a6282373ea1f0fa87a978e004e3ea24dd8955))

# [1.1.0](https://github.com/quanghoangf/vibedoc/compare/v1.0.5...v1.1.0) (2026-04-01)


### Bug Fixes

* address code review issues in description cache functions ([22ef33a](https://github.com/quanghoangf/vibedoc/commit/22ef33a7bd107d0347315ad1cd8d6c383c8e31cd))
* address code review issues in explorer feature ([0bb9c78](https://github.com/quanghoangf/vibedoc/commit/0bb9c78c670c6e3639cb438c3918aadc1dc6a53a))
* address UI component review issues in Explorer ([c0fa6b2](https://github.com/quanghoangf/vibedoc/commit/c0fa6b2155b0c8d4012861f34b2eb69e5d47adc6))
* always place configured root first in discoverProjects ([d81aba3](https://github.com/quanghoangf/vibedoc/commit/d81aba3d4a7378f923b59f7696ef279da8730592))


### Features

* add @anthropic-ai/sdk for file description enrichment ([712743e](https://github.com/quanghoangf/vibedoc/commit/712743ebac0dfca0a41ec13fc5822bb9582c9951))
* add /api/explorer route (GET list + POST enrich) ([68e342a](https://github.com/quanghoangf/vibedoc/commit/68e342adfc7f46e95d0eb6f4a001fa7d9a04a484))
* add /explorer page ([a59717d](https://github.com/quanghoangf/vibedoc/commit/a59717db66db327c7a6cda52ad5f0f7ac8cca35e))
* add description cache helpers to core.ts ([700a7f2](https://github.com/quanghoangf/vibedoc/commit/700a7f2427b31433cfb77860e7e64474d4142722))
* add enrichDescription and listExplorerFiles to core.ts ([7d97e23](https://github.com/quanghoangf/vibedoc/commit/7d97e23596f2773491cb6735fe654cec1b3b1237))
* add Explorer nav item and keyboard shortcut ([9e724c2](https://github.com/quanghoangf/vibedoc/commit/9e724c27f0f171e0785cecce9f540e5e3d3572ef))
* add Explorer UI components (FileDetail, FileTree, FileCards, ExplorerTab) ([ea8296d](https://github.com/quanghoangf/vibedoc/commit/ea8296dbf35d74a4af8ff2a6970c81f7f0b11e7d))
* add ExplorerFile and DescriptionCache types ([5f092b2](https://github.com/quanghoangf/vibedoc/commit/5f092b2f38ec50cf8e1c8fdf7e19440957d21914))
* add vibedoc_get_file_map MCP tool ([fb5bbc5](https://github.com/quanghoangf/vibedoc/commit/fb5bbc5c2b019d4bd93e960091eac265bcf9ae5a))
* auto-enrich description when doc is created ([0332073](https://github.com/quanghoangf/vibedoc/commit/0332073ca7ec825412c2b6ea3e4d12ad105e1799))

## [1.0.5](https://github.com/quanghoangf/vibedoc/compare/v1.0.4...v1.0.5) (2026-03-31)


### Bug Fixes

* configure semantic-release CI ([5ee9173](https://github.com/quanghoangf/vibedoc/commit/5ee917376a5db869d8d67780139df5a7cf78b565))

# 1.0.0 (2026-03-31)


### Bug Fixes

* add error handlers to CLI child processes ([d5ba652](https://github.com/quanghoangf/vibedoc/commit/d5ba65236ea701da8808f4c124da43b6b7761f28))
* add prepublishOnly build step for npm publish ([5164d62](https://github.com/quanghoangf/vibedoc/commit/5164d62cfc2a8bc99bc33f265ab9061ca13dae3c))
* escape apostrophe in SetupWizard JSX ([957536a](https://github.com/quanghoangf/vibedoc/commit/957536a13bb828ea52ef078ba9c3b4ddcd1c1310))
* exclude .next/cache from npm package files ([842209a](https://github.com/quanghoangf/vibedoc/commit/842209a075c4444ec343c53dc0279009d4c8d89a))
* pluralization typo in tech stack count label ([f971381](https://github.com/quanghoangf/vibedoc/commit/f971381aafd13ff5ca0dc6c076b23211bbba3e6d))
* remove leading ./ from bin path in package.json ([d1ddae4](https://github.com/quanghoangf/vibedoc/commit/d1ddae45ba4aa04fee0d1203e0b0ecf1252ab737))
* template content corrections (eslintrc, codeowners, docker-compose) ([53273c9](https://github.com/quanghoangf/vibedoc/commit/53273c90c616e9a733679ac35edfee420c530d92))
* update node version ([8a200d7](https://github.com/quanghoangf/vibedoc/commit/8a200d781723c592b5f8a897d5af3fc4d573e670))
* use require.resolve for next binary and fix prepublishOnly script ([263fda1](https://github.com/quanghoangf/vibedoc/commit/263fda198128a69e62ba3ac8c0f67b5c758676ff))


### Features

* add .npmignore, fix bin next path, add ws dependency for npm publish ([eb7975e](https://github.com/quanghoangf/vibedoc/commit/eb7975edb07371c9541f7541330aececa6f1ef0f))
* add BasicInfo/TeamConventions steps and expand template library ([9ac1ab4](https://github.com/quanghoangf/vibedoc/commit/9ac1ab4b59eac0b9543417ecf501ae63db59c0ae))
* add bin/vibedoc.js CLI entry point ([06637f3](https://github.com/quanghoangf/vibedoc/commit/06637f32f24a30c365cfdcf9cfee843ca27832ba))
* add new placeholder resolution and conditional sections to generate route ([8319f98](https://github.com/quanghoangf/vibedoc/commit/8319f98241beb272e02a5aeebd5b4c510837201f))
* add template presets (src/lib/presets.ts) ([9a7d0f0](https://github.com/quanghoangf/vibedoc/commit/9a7d0f01c14a7f32d12600ba1bc9d19b419d1f35))
* configure package.json for npm publish (bin, files) ([82e149f](https://github.com/quanghoangf/vibedoc/commit/82e149fed16a4c4be62ff268f28616378611382b))
* initial automated release ([dc3b66d](https://github.com/quanghoangf/vibedoc/commit/dc3b66d011e0748e08808c7a97353ccb4890fca7))
* replace TechStackInput with category-tabbed picker + presets ([c2468a8](https://github.com/quanghoangf/vibedoc/commit/c2468a89792ffe88bfde3fa14193d44b131dae9e))
* upgrade existing templates + add monitoring category ([d0f38fa](https://github.com/quanghoangf/vibedoc/commit/d0f38fa0e747f3fe3c0dfaa34d53a0275c5c3c4c))
* wizard UX — step reorder, recommended tab, mode toggle, markdown preview ([0671f49](https://github.com/quanghoangf/vibedoc/commit/0671f49fefe5ba3cb98d7bb08e3ea8b0146a28d6))
