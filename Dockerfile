FROM node:24-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install --global pnpm@11.19.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm prisma:generate
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm build

EXPOSE 3000

CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
