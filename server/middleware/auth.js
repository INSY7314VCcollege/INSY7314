const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Employee = require('../models/Employee');
const { auditLogger } = require('./auditLogger');

/**
 * Authentication middleware for customers
 */
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }

    // Check if user still exists and is active
    const user = await User.findById(decoded.userId || decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    // Check if account is locked
    if (user.isAccountLocked) {
      return res.status(423).json({
        success: false,
        error: 'Account is temporarily locked due to too many failed attempts'
      });
    }

    // Check if password has been changed since token was issued
    if (user.passwordChangedAt && new Date(decoded.iat * 1000) < user.passwordChangedAt) {
      return res.status(401).json({
        success: false,
        error: 'Password has been changed. Please login again.'
      });
    }

    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please refresh your token.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    auditLogger.logError(error, req);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Authentication middleware for employees
 */
const employeeAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'employee_access') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type. Employee token required.'
      });
    }

    // Check if employee still exists and is active
    const employeeId = decoded.employeeId || decoded.id;
    const employee = await Employee.findById(employeeId).select('+passwordHash +salt');
    if (!employee || !employee.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Employee not found or inactive'
      });
    }

    // Check if account is locked
    if (employee.isAccountLocked) {
      return res.status(423).json({
        success: false,
        error: 'Account is temporarily locked due to too many failed attempts'
      });
    }

    // Check if password has been changed since token was issued
    if (employee.passwordChangedAt && new Date(decoded.iat * 1000) < employee.passwordChangedAt) {
      return res.status(401).json({
        success: false,
        error: 'Password has been changed. Please login again.'
      });
    }

    req.employee = employee;
    req.employee.id = employee._id.toString();
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please refresh your token.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    auditLogger.logError(error, req);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication middleware
 * Doesn't fail if no token is provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'access') {
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.userId || decoded.id);
    if (!user || !user.isActive || user.isAccountLocked) {
      req.user = null;
      return next();
    }

    req.user = user;
    next();

  } catch (error) {
    req.user = null;
    next();
  }
};

/**
 * Admin authentication middleware
 */
const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Admin privileges required.'
        });
      }
      next();
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Rate limiting for sensitive operations
 */
const sensitiveOperationAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      // Check if user has made too many sensitive operations recently
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      // In production, check against a database or Redis cache
      // For now, we'll just proceed
      next();
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

module.exports = {
  auth,
  employeeAuth,
  optionalAuth,
  adminAuth,
  sensitiveOperationAuth
};
