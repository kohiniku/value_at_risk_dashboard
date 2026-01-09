# syntax=docker/dockerfile:1.6
FROM node:20-alpine

RUN apk add --no-cache libc6-compat

ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
ARG NEXT_PUBLIC_NEWS_LIMIT=5

ENV NODE_ENV=production \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_NEWS_LIMIT=${NEXT_PUBLIC_NEWS_LIMIT}

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

COPY package.json ./
RUN pnpm install --prod=false

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
