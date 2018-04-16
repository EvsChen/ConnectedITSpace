const Q = require('q');
const mongoose = require('services/dbConnection.service');

const Schema = mongoose.Schema;
const rawDataSchema = new Schema({
  cmd: String,
  flag: String,
  status: String,
  data: [String],
  Time: {
    type: Date,
    default: Date.now,
  },
});
rawDataSchema.index({
  Time: -1
});
const RawData = mongoose.model('RawData', rawDataSchema);
const service = {};
service.add = add;
module.exports = service;

function add(rawDataParams) {
  if (rawDataParams.data) {
    if (typeof rawDataParams.data == 'string') {
      rawDataParams.data = [rawDataParams.data];
    }
  }
  const deferred = Q.defer();
  const rawData = new RawData(rawDataParams);
  rawData.save((err, doc) => {
    if (err) deferred.reject(err);
    else {
      deferred.resolve(doc);
      console.log(doc);
    }
  });
  return deferred.promise;
}
