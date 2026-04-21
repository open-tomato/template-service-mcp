import { z } from 'zod';

export const echoName = 'echo' as const;
export const echoDescription =
  'Echoes back the provided text. Useful as a smoke test.';

export const echoInputSchema = {
  text: z.string().describe('The text to echo back'),
};

export interface EchoInput {
  text: string;
}

export function handleEcho({ text }: EchoInput): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
    content: [{ type: 'text', text }],
  };
}
