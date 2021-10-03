FROM node:14

RUN mkdir -p /usr/src/app/node

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install 

COPY . .

EXPOSE 8000

CMD ["npm", "start"]