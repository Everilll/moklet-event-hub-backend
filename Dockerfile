# ==========================================
# 1. BUILDER STAGE
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files & tsconfig
COPY package*.json ./
COPY tsconfig*.json ./

# Install semua dependencies (termasuk devDependencies untuk build)
RUN npm ci

# Copy source code & prisma schema
COPY . .

# Generate Prisma Client (Akan masuk ke folder /app/generated/prisma)
RUN npx prisma generate

# Build TypeScript (Akan meng-compile src/ dan generated/ ke dalam folder dist/)
RUN npm run build


# ==========================================
# 2. RUNTIME STAGE
# ==========================================
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install HANYA production dependencies
RUN npm ci --omit=dev

# Copy file prisma (Hanya butuh folder prisma untuk keperluan migrate)
COPY prisma ./prisma

# Copy hasil build dari stage builder
# Di dalamnya sudah lengkap: dist/src (kode backend) dan dist/generated (kode prisma)
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Jalankan migrasi lalu start server menggunakan path yang benar (dist/src/main.js)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
