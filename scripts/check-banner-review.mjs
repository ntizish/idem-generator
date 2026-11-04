import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {preflightBanner} from '../server/banner-review.js';
import {BANNER_SIZES,bannerBlocks} from '../src/lib/banner-layout.js';
import {contrastRatio,reviewBanner} from '../src/lib/banner-review.js';

const title='Your next\nbig thing.',descriptor='A little color. A lot of possibility.';
const sparse=preflightBanner({title:'Hello',descriptor,layout:'logo-top'});
assert(sparse.issues.some(issue=>issue.code==='disconnected_content'));
assert.notEqual(sparse.recommendedLayout,'logo-top','Compact copy should move out of the disconnected composition');
assert.equal(sparse.contrastChecked,false,'Preflight must not claim to assess an unpainted background');
const compact=preflightBanner({title,descriptor,layout:'split'});
assert(!compact.issues.some(issue=>issue.code==='disconnected_content'),'Intentional empty space above a bottom-aligned design is allowed');
assert.equal(compact.status,'pass');
const auto=preflightBanner({title,descriptor});
assert.equal(auto.selectedLayout,auto.candidates[0].layout);
assert.deepEqual(preflightBanner({title,descriptor}),auto,'Ranking is deterministic');

const crowded=preflightBanner({title:'W'.repeat(200),descriptor:'x\n'.repeat(300),layout:'split'});
for(const code of ['text_overflow','excessive_shrink','small_text','broken_word'])
  assert(crowded.issues.some(issue=>issue.code===code),`Detect ${code}`);
assert(crowded.candidates.every(candidate=>candidate.status==='revise'),'Do not approve a best-of-bad result');
const orphan=preflightBanner({title:'Make room for\nx',layout:'split'});
assert(orphan.issues.some(issue=>issue.code==='orphan_line'));
const hierarchy=preflightBanner({title:'A longer headline for a very ambitious project that needs much more room to explain what it does',descriptor,layout:'logo-top'});
assert(hierarchy.issues.some(issue=>issue.code==='weak_hierarchy'));
const noCopy=preflightBanner({title,descriptor:'',layout:'split'});
assert(!noCopy.issues.some(issue=>issue.element==='descriptor'),'Optional copy must not create false failures');

const size=BANNER_SIZES.square,canvas=createCanvas(size.width,size.height),context=canvas.getContext('2d');
function paintedReview(color,tone='light') {
  context.fillStyle=color;context.fillRect(0,0,size.width,size.height);
  return reviewBanner(context,{size,texts:{title,descriptor},layout:'split',tone,checkContrast:true});
}
const darkGround=paintedReview('#141414');
assert.equal(darkGround.contrastChecked,true);
assert(!darkGround.issues.some(issue=>issue.code==='low_contrast'));
const paleGround=paintedReview('#eeeeee');
assert(paleGround.issues.some(issue=>issue.code==='low_contrast'));
assert(paleGround.suggestedChanges.some(change=>change.reason.includes('fade')));
const darkOnDark=paintedReview('#141414','dark');
assert(darkOnDark.issues.some(issue=>issue.code==='low_contrast'),'Dark ink on a black fade must be flagged');
const lightGround=paintedReview('#f4f0e5','dark');
assert(!lightGround.issues.some(issue=>issue.code==='low_contrast'));
for(let x=0;x<size.width;x+=8) {
  context.fillStyle=x%16?'white':'black';context.fillRect(x,0,8,size.height);
}
const busy=reviewBanner(context,{size,texts:{title,descriptor},layout:'split',checkContrast:true});
assert(busy.issues.some(issue=>issue.code==='busy_background'));
// A background with calm dark regions behind Offset should change the ranking,
// even though text-only preflight prefers the more compact Stack composition.
context.fillStyle='white';context.fillRect(0,0,size.width,size.height);
context.fillStyle='#141414';
for(const {rect} of bannerBlocks(size,'offset'))context.fillRect(rect.x,rect.y,rect.width,rect.height);
const regional=reviewBanner(context,{size,texts:{title,descriptor},layout:'stack',checkContrast:true});
assert.equal(regional.candidates[0].layout,'offset','Background contrast participates in layout selection');
assert.equal(regional.recommendedLayout,'offset');
assert.equal(contrastRatio([255,255,255],[0,0,0]),21);
assert(contrastRatio([255,255,255],[120,120,120],.7)<contrastRatio([255,255,255],[120,120,120],1),'Descriptor contrast must account for its 70% opacity');
assert(darkGround.requiresVisualReview,'A heuristic pass still needs an agent to inspect the preview');

console.log('Passed: deterministic layout ranking, internal whitespace vs deliberate outer space, overflow, shrinking, legibility, hierarchy, orphans, broken words, sampled contrast with opacity, and busy backgrounds.');
