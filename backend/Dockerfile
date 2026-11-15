# Development image for the DebateApp backend (Express + Apollo GraphQL).
# Uses nodemon for hot-reload; source is bind-mounted via docker-compose.
FROM node:24-alpine

WORKDIR /app

# Install deps first for layer caching.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Source is bind-mounted in compose for hot-reload; copy as a fallback.
COPY . .

EXPOSE 5001
CMD ["yarn", "dev"]
