/**
 * Input Validator
 * Validates and coerces incoming request data against the workflow's input schema.
 * Applies defaults for optional fields.
 */

class InputValidator {
  validate(inputData, schema) {
    const errors = [];
    const coerced = { ...inputData };

    // Apply defaults for missing optional fields
    if (schema.properties) {
      for (const [field, def] of Object.entries(schema.properties)) {
        if (!(field in coerced) && 'default' in def) {
          coerced[field] = def.default;
        }
      }
    }

    // Check required fields
    for (const field of schema.required || []) {
      if (coerced[field] === undefined || coerced[field] === null || coerced[field] === '') {
        errors.push({ field, message: `'${field}' is required` });
      }
    }

    if (errors.length > 0) return { valid: false, errors, data: null };

    // Type and constraint checks
    if (schema.properties) {
      for (const [field, def] of Object.entries(schema.properties)) {
        const val = coerced[field];
        if (val === undefined || val === null) continue;

        if (def.type === 'number') {
          const n = Number(val);
          if (isNaN(n)) {
            errors.push({ field, message: `'${field}' must be a number` });
          } else {
            coerced[field] = n;
            if (def.min !== undefined && n < def.min)
              errors.push({ field, message: `'${field}' must be >= ${def.min}` });
            if (def.max !== undefined && n > def.max)
              errors.push({ field, message: `'${field}' must be <= ${def.max}` });
          }
        }

        if (def.type === 'boolean' && typeof val !== 'boolean') {
          if (val === 'true') coerced[field] = true;
          else if (val === 'false') coerced[field] = false;
          else errors.push({ field, message: `'${field}' must be a boolean` });
        }

        if (def.type === 'string') {
          coerced[field] = String(val);
          if (def.enum && !def.enum.includes(coerced[field])) {
            errors.push({ field, message: `'${field}' must be one of: ${def.enum.join(', ')}` });
          }
        }
      }
    }

    if (errors.length > 0) return { valid: false, errors, data: null };
    return { valid: true, errors: [], data: coerced };
  }
}

module.exports = new InputValidator();
