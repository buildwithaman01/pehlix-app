import bcrypt from 'bcryptjs';
import User from './user.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';
import { calculateBlindIndex } from '../../utils/crypto.js';
import R2Service from '../../utils/r2.js';

export const StaffController = {
  /**
   * Get all staff members for the authenticated lab.
   */
  async getStaff(req, res, next) {
    try {
      const labId = req.user.labId;
      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const roles = ['receptionist', 'technician', 'pathologist', 'phlebotomist'];
      const staff = await User.find({
        labId,
        role: { $in: roles }
      }).select('-passwordHash');

      return sendSuccess(res, staff, 'Staff list retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a new staff member.
   */
  async createStaff(req, res, next) {
    try {
      const labId = req.user.labId;
      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const { name, phone, email, role, password, signature, qualifications, registrationNumber, signatureImageKey } = req.body;

      if (!name || !phone || !role || !password) {
        return sendError(res, 'VALIDATION_FAILED', 'Missing required fields (name, phone, role, password)', {}, 400);
      }

      // Check if user already exists with phone or email using blind indexes
      const phoneBlind = calculateBlindIndex(phone, 'phone');
      const emailBlind = email ? calculateBlindIndex(email, 'email') : null;

      const existingUser = await User.findOne({
        $or: [
          { phoneBlindIndex: phoneBlind },
          ...(emailBlind ? [{ emailBlindIndex: emailBlind }] : [])
        ]
      });

      if (existingUser) {
        return sendError(res, 'DUPLICATE_USER', 'A user with this phone or email already exists', {}, 400);
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newStaff = await User.create({
        labId,
        name,
        phone,
        email,
        role,
        passwordHash,
        signature,
        qualifications,
        registrationNumber,
        signatureImageKey,
        isActive: true
      });

      const staffObj = newStaff.toObject();
      delete staffObj.passwordHash;

      return sendSuccess(res, staffObj, 'Staff member registered successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update staff member details.
   */
  async updateStaff(req, res, next) {
    try {
      const labId = req.user.labId;
      const { id } = req.params;
      const { name, phone, email, role, password, signature, isActive, qualifications, registrationNumber, signatureImageKey } = req.body;

      if (!labId) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'Lab ID is missing in user context', {}, 403);
      }

      const staff = await User.findOne({ _id: id, labId });
      if (!staff) {
        return sendError(res, 'STAFF_NOT_FOUND', 'Staff member not found', {}, 404);
      }

      // If phone is changing, check for duplicate using blind index
      if (phone && phone !== staff.phone) {
        const phoneBlind = calculateBlindIndex(phone, 'phone');
        const existingPhone = await User.findOne({ phoneBlindIndex: phoneBlind, _id: { $ne: id } });
        if (existingPhone) {
          return sendError(res, 'DUPLICATE_USER', 'A user with this phone already exists', {}, 400);
        }
        staff.phone = phone;
      }

      // If email is changing, check for duplicate using blind index
      if (email && email !== staff.email) {
        const emailBlind = calculateBlindIndex(email, 'email');
        const existingEmail = await User.findOne({ emailBlindIndex: emailBlind, _id: { $ne: id } });
        if (existingEmail) {
          return sendError(res, 'DUPLICATE_USER', 'A user with this email already exists', {}, 400);
        }
        staff.email = email;
      }

      if (name) staff.name = name;
      if (role) staff.role = role;
      if (signature !== undefined) staff.signature = signature;
      if (isActive !== undefined) staff.isActive = isActive;
      
      // Phase 3.5 pathologist credentials
      if (qualifications !== undefined) staff.qualifications = qualifications;
      if (registrationNumber !== undefined) staff.registrationNumber = registrationNumber;
      if (signatureImageKey !== undefined) staff.signatureImageKey = signatureImageKey;

      if (password) {
        staff.passwordHash = await bcrypt.hash(password, 10);
        staff.tokenVersion = (staff.tokenVersion || 0) + 1; // invalidate current tokens
      }

      await staff.save();

      const staffObj = staff.toObject();
      delete staffObj.passwordHash;

      return sendSuccess(res, staffObj, 'Staff member updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generates a pre-signed URL for uploading a pathologist's signature.
   */
  async getSignatureUploadUrl(req, res, next) {
    try {
      const { id } = req.params;
      const labId = req.user.labId;

      // Restrict update to owners or the user themselves (NABL compliance & Security)
      if (req.user.role !== 'owner' && req.user.userId.toString() !== id.toString()) {
        return sendError(res, 'AUTH_INSUFFICIENT_PERMISSIONS', 'You do not have permission to upload signature for this user', {}, 403);
      }

      const staff = await User.findOne({ _id: id, labId });
      if (!staff) {
        return sendError(res, 'STAFF_NOT_FOUND', 'Staff member not found', {}, 404);
      }

      const key = `labs/${labId}/signatures/${id}.png`;
      const uploadUrl = await R2Service.getSignedUploadUrl(key, 'image/png', 3600);

      staff.signatureImageKey = key;
      await staff.save();

      return sendSuccess(res, { uploadUrl, key }, 'Pre-signed upload URL generated successfully');
    } catch (error) {
      next(error);
    }
  }
};

export default StaffController;
