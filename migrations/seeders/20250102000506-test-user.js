'use strict';

const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('password123', 10);

    await queryInterface.bulkInsert('Users', [
      {
        name: 'John Doe',
        username: 'johndoe',
        email: 'johndoe@example.com',
        password: hashedPassword, 
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Users', { email: 'johndoe@example.com' }, {});
  }
};