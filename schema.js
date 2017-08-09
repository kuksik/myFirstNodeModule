function DB() {}

DB.prototype.createSchema = function createSchema(mongoose) {
  const Schema = mongoose.Schema;

  const imageSchema = new Schema({
    cropParams: {
      pieces: {
        type: Number,
        require: true,
      },
      direction: {
        type: String,
        require: true,
        default: 'horizontal',
        enum: ['vertical', 'horizontal'],
      },
    },
    size: {
      width: {
        type: Number,
        require: true,
      },
      height: {
        type: Number,
        require: true,
      },
    },
    cropped: {
      type: Boolean,
      require: true,
      default: false,
    },
    path: {
      type: String,
      require: true,
    },
    ext: {
      type: String,
      require: true,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
  });

  const Image = mongoose.model('Image', imageSchema);

  return Image;
};

module.exports = function factory() {
  return new DB();
};
