const zod = require("zod");

const idetifyValidation = zod
  .object({
    email: zod.string().email().nullable(),
    phoneNumber: zod.string().nullable(),
  })
  .refine((data) => data.email || data.phoneNumber, {
    message: "Either email or phoneNumber must be provided",
  });

module.exports = {
  idetifyValidation,
};
