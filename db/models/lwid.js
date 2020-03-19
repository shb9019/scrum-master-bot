'use strict';
module.exports = (sequelize, DataTypes) => {
  const lwid = sequelize.define('lwid', {
    name: DataTypes.STRING,
    content: DataTypes.STRING,
    date: DataTypes.DATE,
    message_ts: DataTypes.STRING,
    channel_id: DataTypes.STRING
  }, {});
  lwid.associate = function(models) {
    // associations can be defined here
  };
  return lwid;
};
