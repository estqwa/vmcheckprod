FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /repo

# Copy workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json ./shared/package.json
COPY trivia-apinewfront/package.json ./trivia-apinewfront/package.json
COPY trivia-mobile/package.json ./trivia-mobile/package.json

# Install workspace dependencies required for web build (+ shared build tooling).
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /repo/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /repo/shared/package.json ./shared/package.json
COPY --from=deps /repo/trivia-apinewfront/package.json ./trivia-apinewfront/package.json
COPY --from=deps /repo/trivia-mobile/package.json ./trivia-mobile/package.json
COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Build shared first, then web standalone output.
RUN pnpm --filter @trivia/shared build
RUN pnpm --filter trivia-apinewfront build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next standalone output for monorepo is nested under trivia-apinewfront/
COPY --from=builder --chown=nextjs:nodejs /repo/trivia-apinewfront/.next-build/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/trivia-apinewfront/.next-build/static ./trivia-apinewfront/.next-build/static
COPY --from=builder --chown=nextjs:nodejs /repo/trivia-apinewfront/public ./trivia-apinewfront/public

WORKDIR /app/trivia-apinewfront
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
