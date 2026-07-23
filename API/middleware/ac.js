const { AccessControl } = require('accesscontrol');

const ac = new AccessControl();

// Observer Role - Basic read-only access
ac.grant('Observer')
  .readAny('reconciliation')
  .readOwn('users')
  .createOwn('users')
  .updateOwn('users')
  .deleteOwn('users')
  // Exam viewing permissions
  .readAny('exams')
  .readAny('subjects')
  .readAny('questions')
  .readAny('options')
  // Can take exams (read-only for taking)
  .readOwn('exam_taking')

// User Role - Standard user with exam taking capabilities
ac.grant('User')
  .readOwn('users')
  .readAny('logins')
  .readAny('notifications')
  .readOwn('payment')
  .createOwn('users')
  .updateOwn('users')
  .deleteOwn('users')
  // Exam permissions for users
  .readAny('exams')
  .readAny('subjects')
  .readAny('questions')
  .readAny('options')
  // Can take exams
  .createOwn('exam_taking')    // Start/begin exam
  .updateOwn('exam_taking')    // Submit answers
  .readOwn('exam_taking')      // View their own exam results
  .deleteOwn('exam_taking')    // Clear exam session

// Admin Role - Full access to everything
ac.grant('Admin')
  .extend('User')
  // User management
  .readAny('users')
  .createAny('users')
  .updateAny('users')
  .deleteAny('users')
  // Exam management
  .createAny('exams')
  .updateAny('exams')
  .deleteAny('exams')
  // Subject management
  .createAny('subjects')
  .updateAny('subjects')
  .deleteAny('subjects')
  // Question management
  .createAny('questions')
  .updateAny('questions')
  .deleteAny('questions')
  // Option management
  .createAny('options')
  .updateAny('options')
  .deleteAny('options')
  // Full exam taking access (can view all exam results)
  .readAny('exam_taking')
  .updateAny('exam_taking')
  .deleteAny('exam_taking')

module.exports = ac;