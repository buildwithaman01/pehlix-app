import { encryptField, decryptField, calculateBlindIndex } from './crypto.js';

/**
 * Mongoose plugin to automatically encrypt and decrypt schema fields.
 * Encrypts fields on save/update, and decrypts them on retrieval.
 * Also automatically translates query filters on encrypted fields to use blind indexes.
 */
export default function mongooseEncryptionPlugin(schema, options = {}) {
  const fields = options.fields || [];
  
  if (!fields.length) return;

  // 1. Attach getters to decrypt fields on access, and strip built-in case/trim setters that corrupt ciphertext
  fields.forEach(field => {
    const path = schema.path(field);
    if (path) {
      // Remove Mongoose's built-in lowercase option to avoid corrupting base64 ciphertext
      if (path.options.lowercase) {
        path.options.lowercase = false;
        if (Array.isArray(path.setters)) {
          path.setters = path.setters.filter(setter => {
            try {
              return setter('ABC') !== 'abc';
            } catch (e) {
              return true;
            }
          });
        }
      }

      // Remove Mongoose's built-in trim option to avoid stripping spaces from ciphertext
      if (path.options.trim) {
        path.options.trim = false;
        if (Array.isArray(path.setters)) {
          path.setters = path.setters.filter(setter => {
            try {
              return setter(' ABC ') !== 'ABC';
            } catch (e) {
              return true;
            }
          });
        }
      }

      path.get(function (val) {
        return decryptField(val);
      });
    }
  });

  // Ensure getters are applied when converting documents to JSON/Objects
  schema.set('toObject', { getters: true, virtuals: true });
  schema.set('toJSON', { getters: true, virtuals: true });

  // 2. Pre-save hook to encrypt modified plaintext fields
  schema.pre('save', function () {
    const doc = this;
    
    fields.forEach(field => {
      if (doc.isModified(field)) {
        const val = doc.get(field);
        
        if (val !== null && val !== undefined && val !== '') {
          if (typeof val === 'string' && val.startsWith('__enc__:')) {
            return;
          }
          doc.set(field, encryptField(val));
        }
      }
    });
  });

  // 3. Pre-update hook for findOneAndUpdate / updateOne updates
  schema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate();
    if (!update) return;

    // Check $set operators
    if (update.$set) {
      fields.forEach(field => {
        const val = update.$set[field];
        if (val !== null && val !== undefined && val !== '') {
          if (typeof val === 'string' && val.startsWith('__enc__:')) {
            return;
          }
          update.$set[field] = encryptField(val);
        }
      });
    } else {
      // Direct updates (e.g. { phone: '...' })
      fields.forEach(field => {
        const val = update[field];
        if (val !== null && val !== undefined && val !== '') {
          if (typeof val === 'string' && val.startsWith('__enc__:')) {
            return;
          }
          update[field] = encryptField(val);
        }
      });
    }
  });

  // 4. Pre-query hook to translate exact-match queries to blind index queries
  const queryHooks = ['find', 'findOne', 'countDocuments', 'findOneAndUpdate', 'updateOne', 'deleteMany', 'deleteOne'];
  queryHooks.forEach(hookName => {
    schema.pre(hookName, function () {
      const query = this.getQuery();
      if (!query) return;

      fields.forEach(field => {
        // Translate direct value queries, e.g. { phone: '9999999999' }
        if (query[field] !== undefined) {
          const val = query[field];
          if (typeof val === 'string' && !val.startsWith('__enc__:') && !val.includes('$') && !val.includes('*')) {
            const type = field === 'email' ? 'email' : 'phone';
            query[`${field}BlindIndex`] = calculateBlindIndex(val, type);
            delete query[field];
          }
        }
        
        // Translate $or array queries, e.g. { $or: [{ phone: '...' }, { email: '...' }] }
        if (query.$or && Array.isArray(query.$or)) {
          query.$or.forEach(cond => {
            if (cond[field] !== undefined) {
              const val = cond[field];
              if (typeof val === 'string' && !val.startsWith('__enc__:') && !val.includes('$') && !val.includes('*')) {
                const type = field === 'email' ? 'email' : 'phone';
                cond[`${field}BlindIndex`] = calculateBlindIndex(val, type);
                delete cond[field];
              }
            }
          });
        }
      });
    });
  });
}
