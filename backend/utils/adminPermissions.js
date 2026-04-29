import Admin from '../models/Admin.js';

/**
 * Admin permission utilities for role-based access control
 */

// Check if user has specific admin permission
export const checkAdminPermission = async (userId, requiredPermission) => {
  try {
    const admin = await Admin.findOne({ user: userId });
    if (!admin || !admin.isActive) {
      return false;
    }
    return admin.permissions.includes(requiredPermission);
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return false;
  }
};

// Check if user is an active admin
export const isActiveAdmin = async (userId) => {
  try {
    const admin = await Admin.findOne({ user: userId, isActive: true });
    return !!admin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Get admin permissions
export const getAdminPermissions = async (userId) => {
  try {
    const admin = await Admin.findOne({ user: userId });
    return admin?.permissions || [];
  } catch (error) {
    console.error('Error fetching admin permissions:', error);
    return [];
  }
};

// Check multiple permissions (any match required)
export const checkAnyPermission = async (userId, permissions) => {
  try {
    const admin = await Admin.findOne({ user: userId });
    if (!admin || !admin.isActive) {
      return false;
    }
    return permissions.some(perm => admin.permissions.includes(perm));
  } catch (error) {
    console.error('Error checking multiple permissions:', error);
    return false;
  }
};

// Check all permissions (all must match)
export const checkAllPermissions = async (userId, permissions) => {
  try {
    const admin = await Admin.findOne({ user: userId });
    if (!admin || !admin.isActive) {
      return false;
    }
    return permissions.every(perm => admin.permissions.includes(perm));
  } catch (error) {
    console.error('Error checking all permissions:', error);
    return false;
  }
};

// Get admin by user ID with populated user data
export const getAdminByUserId = async (userId) => {
  try {
    return await Admin.findOne({ user: userId }).populate('user', 'name email role');
  } catch (error) {
    console.error('Error fetching admin by user ID:', error);
    return null;
  }
};

// Update admin last login timestamp
export const updateAdminLastLogin = async (userId) => {
  try {
    await Admin.findOneAndUpdate(
      { user: userId },
      { lastLogin: new Date() },
      { new: true }
    );
  } catch (error) {
    console.error('Error updating admin last login:', error);
  }
};
