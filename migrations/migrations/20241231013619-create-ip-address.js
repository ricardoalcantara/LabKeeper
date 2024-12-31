"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("IpAddresses", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      hostId: {
        type: Sequelize.INTEGER,
        references: {
          model: "Hosts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      address: {
        type: Sequelize.STRING,
      },
      cidrMask: {
        type: Sequelize.INTEGER,
      },
      macAddress: {
        type: Sequelize.STRING,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("IpAddresses");
  },
};
