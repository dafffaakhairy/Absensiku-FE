
FROM node:22-alpine

WORKDIR /app

# Salin manifest dependency terlebih dahulu
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# Instal dependency sesuai package manager
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && pnpm install --frozen-lockfile; \
    elif [ -f yarn.lock ]; then \
      corepack enable && yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi

# Salin source code frontend
COPY . .

# Build Next.js untuk production
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN npm run build

EXPOSE 3000

# Jalankan production server
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
