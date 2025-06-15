FROM node:24-alpine3.21

RUN npm install -g pnpm

RUN pnpm setup

RUN pnpm add turbo --global

WORKDIR /app

COPY . .

RUN pnpm i

RUN pnpm i --recursive --frozen-lockfile

RUN turbo build

CMD ["pnpm", "run", "dev"]