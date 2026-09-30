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
