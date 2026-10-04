# Read-only VibeDoc demo: the app in VIBEDOC_DEMO mode, pointed at examples/demo-project.
# Build: docker build -t vibedoc-demo .   Run: docker run -p 3000:3000 vibedoc-demo
FROM node:22-alpine
WORKDIR /app
RUN npm i -g pnpm@10
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV NODE_ENV=production VIBEDOC_DEMO=1 VIBEDOC_ROOT=/app/examples/demo-project PORT=3000
EXPOSE 3000
# next start reads PORT, so hosts that inject their own PORT work unchanged
CMD ["pnpm", "start"]
