# DEVELOPMENT IMAGE
FROM node:18.12.1 AS development
LABEL maintainer="Emeka C. Anyanwu, Center for Healthcare Innovation, Penn Medicine"

USER node

WORKDIR /app/server
COPY --chown=node:node server/package*.json /app/server/

RUN npm ci

WORKDIR /app/server
COPY --chown=node:node server .

RUN npm run build

CMD ["npm", "run", "start:dev"]

# # PRODUCTION IMAGE
FROM node:18.12.1 AS production

USER node

COPY --chown=node:node --from=development /app /app
WORKDIR /app/server

RUN npm prune --production

CMD ["npm", "run", "start:prod"]