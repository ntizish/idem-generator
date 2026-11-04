import {randomInt} from 'node:crypto';
import {z} from 'zod';
import {presets} from '../src/lib/palettes.js';
import {BANNER_LAYOUTS} from '../src/lib/banner-layout.js';

export const bannerInputSchema = z.object({
  title: z.string().trim().min(1).max(240).describe('Banner headline. Use line breaks for intentional wrapping.'),
  descriptor: z.string().max(600).default('').describe('Supporting copy below the headline.'),
  format: z.enum(['square','landscape']).default('square').describe('square: 1024 × 1024; landscape: 1920 × 1080.'),
  layout: z.enum(['auto',...BANNER_LAYOUTS.map(layout=>layout.id)]).default('auto').describe('auto reviews all six approved compositions and picks the best fit. A named layout is kept fixed and returned with review feedback.'),
  palette: z.enum(presets.map(preset=>preset.name)).default(presets[0].name),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(2).max(6).optional().describe('Optional custom hex pigments; overrides palette.'),
  tone: z.enum(['light','dark']).default('light').describe('Foreground ink: light means white text and logo.'),
  background: z.enum(['painted','solid']).default('painted').describe('Procedural oil painting, or a plain background matching the ink.'),
  fade: z.enum(['none','left','top','right','bottom']).default('left').describe('Black gradient starting at the selected edge; none disables it.'),
  seed: z.number().int().min(0).max(0xffffffff).optional().describe('Reuse a seed and the same settings to reproduce a painting.'),
}).strict();

// Versioned recipes make downloadable URLs independent of a server instance.
export const bannerRecipeSchema = bannerInputSchema.extend({layout:z.enum(BANNER_LAYOUTS.map(layout=>layout.id)).default('logo-top'),seed:z.number().int().min(0).max(0xffffffff),version:z.union([z.literal(1),z.literal(2)])}).refine(recipe=>recipe.version!==1||['split','editorial','stack','offset'].includes(recipe.layout),{message:'Unknown version 1 layout',path:['layout']});

export function bannerRecipe(input) {
  const options=bannerInputSchema.parse(input);
  return bannerRecipeSchema.parse({...options,layout:options.layout==='auto'?'logo-top':options.layout,seed:options.seed??randomInt(0x100000000),version:2});
}

export function bannerFilename(recipe) {
  const size=recipe.format==='square'?'1024x1024':'1920x1080';
  return `idem-banner-${size}-${recipe.seed}.png`;
}
