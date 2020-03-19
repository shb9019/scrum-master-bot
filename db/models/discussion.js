'use strict';
module.exports = (sequelize, DataTypes) => {
  const discussion = sequelize.define('discussion', {
    topic: DataTypes.STRING,
    content: DataTypes.STRING,
    date: DataTypes.DATE,
    message_ts: DataTypes.STRING,
    channel_id: DataTypes.STRING
  }, {});
  discussion.associate = function(models) {
    // associations can be defined here
  };
  return discussion;
};
