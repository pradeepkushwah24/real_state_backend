const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT, // 👈 ADD THIS
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  ssl: {
    rejectUnauthorized: false // 👈 REQUIRED for Railway
  }
});

const promisePool = pool.promise();

const initDatabase = async () => {
  try {
    const connection = await promisePool.getConnection();
    console.log('✅ Database connected');

    // Users Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(15),
        role ENUM('user', 'agent', 'admin') DEFAULT 'user',
        is_verified BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        last_login_ip VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Admins Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(15),
        last_login TIMESTAMP NULL,
        last_login_ip VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Properties Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id VARCHAR(20) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        price VARCHAR(50) NOT NULL,
        location VARCHAR(255) NOT NULL,
        size VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        purpose VARCHAR(20) DEFAULT 'sale',
        bedrooms INT DEFAULT 0,
        bathrooms INT DEFAULT 0,
        description TEXT,
        images JSON,
        status VARCHAR(20) DEFAULT 'active',
        views INT DEFAULT 0,
        agent_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Buyers Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS buyers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        phone VARCHAR(15) NOT NULL,
        city VARCHAR(100),
        message TEXT,
        property_id VARCHAR(20),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sellers Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sellers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        property_type VARCHAR(50) NOT NULL,
        size VARCHAR(50) NOT NULL,
        price VARCHAR(50) NOT NULL,
        location VARCHAR(255) NOT NULL,
        description TEXT,
        photos JSON,
        videos JSON,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Default Admin
    await connection.query(
      `INSERT IGNORE INTO users (name, email, password, phone, role, is_verified) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Admin', 'admin@4pgr.com', 'admin123', '9999999999', 'admin', true]
    );

    console.log('✅ All tables ready');
    connection.release();

  } catch (error) {
    console.error('❌ Database error:', error);
  }
};

module.exports = { pool, promisePool, initDatabase };