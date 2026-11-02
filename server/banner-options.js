import {randomInt} from 'node:crypto';
import {z} from 'zod';
import {presets} from '../src/lib/palettes.js';

export const bannerInputSchema = z.object({
  title: z.string().trim().min(1).max(240).describe('Banner headline. Use line breaks for intentional wrapping.'),
  descriptor: z.string().max(600).default('').describe('Supporting copy below the headline.'),
  format: z.enum(['square','landscape']).default('square').describe('square: 1024 × 1024; landscape: 1920 × 1080.'),
  layout: z.enum(['split','editorial','stack','offset']).default('split'),
  palette: z.enum(presets.map(preset=>preset.name)).default(presets[0].name),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(2).max(6).optional().describe('Optional custom hex pigments; overrides palette.'),
  tone: z.enum(['light','dark']).default('light').describe('Foreground ink: light means white text and logo.'),
  background: z.enum(['painted','solid']).default('painted').describe('Procedural oil painting, or a plain background matching the ink.'),
  fade: z.enum(['none','left','top','right','bottom']).default('left').describe('Black gradient starting at the selected edge; none disables it.'),
  seed: z.number().int().min(0).max(0xffffffff).optional().describe('Reuse a seed and the same settings to reproduce a painting.'),
}).strict();

// Versioned recipes make downloadable URLs independent of a server instance.
export const bannerRecipeSchema = bannerInputSchema.extend({seed:z.number().int().min(0).max(0xffffffff),version:z.literal(1)});

export function bannerRecipe(input) {
  const options=bannerInputSchema.parse(input);
  return bannerRecipeSchema.parse({...options,seed:options.seed??randomInt(0x100000000),version:1});
}

export function bannerFilename(recipe) {
  const size=recipe.format==='square'?'1024x1024':'1920x1080';
  return `idem-banner-${size}-${recipe.seed}.png`;
}
