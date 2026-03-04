FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

ENV NODE_ENV=production

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start"]
