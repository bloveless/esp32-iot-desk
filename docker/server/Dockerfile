FROM node:14.11-stretch

RUN mkdir -p /home/node/app && chown -R node:node /home/node

USER node

WORKDIR /home/node/app

COPY --chown=node:node ./package.json ./package-lock.json /home/node/app/

RUN npm install

COPY . /home/node/app

CMD ["npm", "start"]
