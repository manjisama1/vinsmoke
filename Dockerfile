FROM node:24

RUN apt-get update && apt-get install -y git ffmpeg python3 build-essential

RUN git clone https://github.com/manjisama1/vinsmoke.git /root/vinsmoke

WORKDIR /root/vinsmoke

RUN npm install

CMD ["node", "index.js"]