FROM node:20-alpine

RUN git clone https://github.com/manjisama1/vinsmoke.git /root/vinsmoke

WORKDIR /root/vinsmoke/

RUN npm install

CMD ["npm", "start"]