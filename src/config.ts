import process from 'node:process';

import { z } from 'zod';

// Placeholder — authored in full in Step 05.3. No env vars required.
const EnvSchema = z.object({});

export const config = EnvSchema.parse(process.env);
