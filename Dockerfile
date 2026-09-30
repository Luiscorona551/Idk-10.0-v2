FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add --no-cache qemu-system-x86_64 qemu-img \
    && npm install --omit=dev --no-audit --no-fund --package-lock=false
COPY . .

ENV PORT=8080
ENV ENABLE_QEMU=true
ENV QEMU_BINARY=qemu-system-x86_64
ENV QEMU_IMG_BINARY=qemu-img
EXPOSE 8080
CMD ["npm", "start"]
