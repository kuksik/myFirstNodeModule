/* eslint strict: ["error", "global"] */
'use strict';
const path = require('path');
const fs = require('fs');
const gm = require('gm');
const fileType = require('file-type');
const request = require('request').defaults({ encoding: null });
const DB = require('./schema.js')();


function Mfm() {}

Mfm.prototype.connectToDB = function connectToDB(mongoose) {
  this.Image = DB.createSchema(mongoose);
};

Mfm.prototype.setRootDir = function setRootDir(dirName) {
  try {
    if (typeof dirName !== 'string' || !dirName) {
      throw Error('root directory name is invalid');
    }
    if (!fs.existsSync(dirName)) {
      this.rootDir = dirName;
      fs.mkdirSync(dirName);
    } else {
      this.rootDir = dirName;
    }
  } catch (e) {
    throw e;
  }
};

Mfm.prototype.createImageDir = function createImageDir(imageName) {
  if (!this.rootDir) {
    throw new Error('pleace set root directory');
  }
  try {
    const timeStamp = (new Date()).valueOf().toString();
    const newDir = `${this.rootDir}/${imageName}_${timeStamp}`;

    fs.mkdirSync(newDir);
    return newDir;
  } catch (e) {
    throw e;
  }
};

Mfm.prototype.saveImage = async function saveImage({ path: pathToDir, cropParams, ext, size }) {
  try {
    const { Image } = this;
    const newImage = new Image({ path: pathToDir, cropParams, ext, size });

    return await newImage.save();
  } catch (e) {
    throw e;
  }
};

Mfm.prototype.getAllImagesInfo = async function getAllImagesInfo() {
  try {
    const { Image } = this;

    return await Image.find();
  } catch (e) {
    throw e;
  }
};

Mfm.prototype.getImageInfo = async function getImageInfo(imageId) {
  if (!imageId) {
    throw new Error('imageId is invalid');
  }

  try {
    const { Image } = this;

    return await Image.findOne({ _id: imageId }) || {};
  } catch (e) {
    throw e;
  }
};

Mfm.prototype.getImagePiece = async function getImagePiece({ imageId, pieceNum }) {
  return new Promise(async (resolve, reject) => {
    if (!imageId) {
      return reject('imageId is invalid');
    }
    if (typeof pieceNum !== 'number' || pieceNum % 1 || pieceNum < 1) {
      return reject('pieceNum should be a positive integer');
    }

    try {
      const {
        ext,
        cropped,
        path: pathToDir,
        cropParams: { pieces },
      } = await this.getImageInfo(imageId);

      if (!cropped) {
        reject('this image has not been cropped yet');
      }

      if (pieces < pieceNum) {
        reject(`only ${pieces} pieces`);
      }

      fs.readFile(`${pathToDir}/${pieceNum - 1}.${ext}`, (err, data) => {
        if (err) reject(err);

        resolve(data);
      });
    } catch (e) {
      reject(e);
    }
  });
};

Mfm.prototype.getImage = async function getImage(imageId) {
  return new Promise(async (resolve, reject) => {
    if (!this.rootDir) {
      return reject('pleace set root directory');
    }
    if (!imageId) {
      return reject('imageId is invalid');
    }

    try {
      const { path: pathToDir, ext } = await this.getImageInfo(imageId);

      fs.readFile(`${pathToDir}/index.${ext}`, (err, data) => {
        if (err) reject(err);
        resolve(data);
      });
    } catch (e) {
      reject(e);
    }
  });
};

Mfm.prototype.imageSize = function imageSize(image) {
  return new Promise((resolve, reject) => {
    if (!this.rootDir) {
      return reject('pleace set root directory');
    }
    gm(image)
      .size((e, size) => {
        if (e) reject(e);

        resolve(size);
      });
  });
};

Mfm.prototype.loadImage = function loadImage({ url: imageUrl, cropParams }) {
  return new Promise((resolve, reject) => {
    if (!this.rootDir) {
      return reject('pleace set root directory');
    }

    request(imageUrl, (error, res, body) => {
      if (!error && res.statusCode === 200) {
        const { ext } = fileType(body);
        const imageName = path.basename(res.request.uri.pathname).split('.')[0];
        const pathToDir = this.createImageDir(imageName);

        fs.writeFile(`${pathToDir}/index.${ext}`, body, async (err) => {
          if (err) {
            reject(err);
          }
          try {
            const size = await this.imageSize(`${pathToDir}/index.${ext}`);
            const image = await this.saveImage({ path: pathToDir, ext, cropParams, size });
            resolve(image);
          } catch (e) {
            reject(e);
          }
        });
      } else {
        reject(error);
      }
    });
  });
};

Mfm.prototype.cropImage = function cropImage(imageId) {
  return new Promise(async (resolve, reject) => {
    if (!this.rootDir) {
      return reject('pleace set root directory');
    }
    try {
      const {
        ext,
        path: pathToDir,
        cropParams: { pieces },
        size: { width, height },
      } = await this.getImageInfo(imageId);

      const image = `${pathToDir}/index.${ext}`;
      const array = new Array(pieces).fill(0);
      const pieceWidth = width / pieces;
      let xShift = 0;

      const promises = array.map((item, index) => {
        const promise = new Promise((res, rej) => {
          gm(image)
            .crop(pieceWidth, height, xShift)
            .write(`${pathToDir}/${index}.${ext}`, (err) => {
              if (err) rej(err);

              res(true);
            });
        });
        xShift += pieceWidth;
        return promise;
      });

      Promise.all(promises)
        .then(async () => {
          try {
            const { Image } = this;
            const { ok } = await Image.update({ _id: imageId }, { $set: { cropped: true } });
            resolve(!ok);
          } catch (e) {
            reject(e);
          }
        }).catch((error) => {
          reject(error);
        });
    } catch (e) {
      reject(e);
    }
  });
};


module.exports = Mfm;
