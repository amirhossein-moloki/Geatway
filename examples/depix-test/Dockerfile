FROM node:20-alpine

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy monorepo root configuration files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./

# Copy packages and depix-test example source code
COPY packages ./packages
COPY examples/depix-test ./examples/depix-test

# Install dependencies across workspace
RUN pnpm install --frozen-lockfile

# Build all packages and applications
RUN pnpm build

WORKDIR /app/examples/depix-test

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV USE_MOCK_GATEWAYS=true

CMD ["pnpm", "start"]
