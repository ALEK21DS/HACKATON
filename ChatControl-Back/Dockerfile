FROM node:20-bullseye-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
  libssl1.1 \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# install dependencies first for better caching
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Prisma generator needs the schema copy before generation
COPY prisma ./prisma
RUN npx prisma generate

# copy application source
COPY . .

RUN pnpm run build

EXPOSE 3001

CMD ["pnpm", "run", "start:prod"]
