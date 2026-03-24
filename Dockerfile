FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production \
    B2B_LOAD_DOTENV=0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENTRYPOINT ["node", "runtime/cloud-run-job.js"]
