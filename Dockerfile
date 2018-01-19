FROM node:7.6-alpine

RUN mkdir -p /src/app

WORKDIR /src/app

COPY . /src/app

RUN npm install

CMD [ "npm", "run", "build" ]
CMD [ "npm", "start" ]

EXPOSE 3000