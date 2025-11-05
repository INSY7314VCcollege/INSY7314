/**
 * Script to create a demo employee for testing the employee portal
 * Usage: node scripts/create-demo-employee.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../server/models/Employee');

const demoEmployee = {
  employeeId: 'EMP001',
  fullName: 'John Smith',
  username: 'jsmith',
  passwordHash: 'Demo123!@#', // Will be hashed by pre-save hook
  email: 'john.smith@bank.com',
  department: 'International Payments',
  role: 'EMPLOYEE',
  isActive: true
};

async function createDemoEmployee() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || `mongodb://${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '27017'}/${process.env.DB_NAME || 'secure_payments_portal'}`;
    
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Check if employee already exists
    const existingEmployee = await Employee.findOne({
      $or: [
        { employeeId: demoEmployee.employeeId },
        { username: demoEmployee.username },
        { email: demoEmployee.email }
      ]
    });

    if (existingEmployee) {
      console.log('⚠️  Employee already exists with these credentials:');
      console.log(`   Employee ID: ${existingEmployee.employeeId}`);
      console.log(`   Username: ${existingEmployee.username}`);
      console.log(`   Email: ${existingEmployee.email}`);
      console.log('\n   To reset the password, delete the employee and run this script again.');
      await mongoose.disconnect();
      return;
    }

    // Create new employee
    const employee = new Employee(demoEmployee);
    await employee.save();

    console.log('\n✅ Demo employee created successfully!\n');
    console.log('📋 Login Credentials:');
    console.log('   Employee ID: EMP001');
    console.log('   Username: jsmith');
    console.log('   Password: Demo123!@#');
    console.log('\n🌐 Employee Portal URL:');
    console.log('   http://localhost:3000/employee/login');
    console.log('\n⚠️  Note: Change this password in production!');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating demo employee:', error.message);
    if (error.code === 11000) {
      console.error('   Duplicate key error - employee with this ID, username, or email already exists');
    }
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
createDemoEmployee();

