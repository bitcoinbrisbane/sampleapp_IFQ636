# Development image for the DebateApp frontend (Create React App dev server).
# Source is bind-mounted via docker-compose for hot-reload.
FROM node:24-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

EXPOSE 3000
# CHOKIDAR_USEPOLLING helps file-watching work reliably inside Docker on macOS.
ENV CHOKIDAR_USEPOLLING=true
CMD ["yarn", "start"]
