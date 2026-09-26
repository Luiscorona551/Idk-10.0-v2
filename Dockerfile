FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add --no-cache qemu-system-x86_64 qemu-img \
    && npm install --omit=dev --no-audit --no-fund
COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
