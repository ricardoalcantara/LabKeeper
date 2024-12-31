'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class IpAddress extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  IpAddress.init({
    hostId: DataTypes.INTEGER,
    address: DataTypes.STRING,
    cidrMask: DataTypes.INTEGER,
    macAddress: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'IpAddress',
  });
  return IpAddress;
};