import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's native TypeScript runner requires the explicit .ts extension.
import { guideLessons } from '../components/strikex/onboarding-content.ts';
// @ts-expect-error Node's native TypeScript runner requires the explicit .ts extension.
import { lessonsFor, markLessonRead, restoreGuide } from '../components/strikex/onboarding-state.ts';
import type { GuideRole } from '../components/strikex/onboarding-content';

test('broken or obsolete browser preferences never block entry or mark the guide complete', () => {
  for (const raw of [null, '{broken', 'null', '[]', '17', '{"role":"admin","lessonId":"missing","completed":["missing",null],"dismissed":"true"}']) {
    const state = restoreGuide(raw, guideLessons);
    assert.equal(state.role, 'athlete');
    assert.equal(state.lessonId, 'overview');
    assert.deepEqual(state.completed, []);
    assert.equal(state.dismissed, false);
  }
});

test('reading can resume after reload and switching tracks keeps only valid lesson references', () => {
  const saved = restoreGuide(JSON.stringify({role:'manager',lessonId:'team',completed:['overview','team','team','obsolete'],started:true,dismissed:true}),guideLessons);
  assert.equal(saved.lessonId, 'team');
  assert.deepEqual(saved.completed, ['overview','team']);
  assert.equal(saved.dismissed, true);
  const athlete = restoreGuide(JSON.stringify({...saved,role:'athlete'}),guideLessons);
  assert.equal(athlete.lessonId, 'overview');
  assert.equal(lessonsFor(athlete.role,guideLessons).some(lesson=>lesson.id==='team'),false);
  assert.equal(lessonsFor(athlete.role,guideLessons).filter(lesson=>athlete.completed.includes(lesson.id)).length,1);
});

test('jumping to the last lesson cannot falsely complete unread lessons', () => {
  const state=restoreGuide(JSON.stringify({role:'coach',lessonId:'boundaries',started:true}),guideLessons);
  const next=markLessonRead(state,guideLessons);
  assert.equal(next.finished,false);
  assert.equal(next.state.lessonId,'overview');
  assert.deepEqual(next.state.completed,['boundaries']);
});

test('each role can finish its full track, including resuming already-read lessons', () => {
  for (const role of ['athlete','coach','manager'] as GuideRole[]) {
    let state=restoreGuide(JSON.stringify({role,started:true}),guideLessons);
    const visible=lessonsFor(role,guideLessons);
    for(let i=0;i<visible.length;i++) {
      const next=markLessonRead(state,guideLessons);
      state=restoreGuide(JSON.stringify(next.state),guideLessons);
      assert.equal(next.finished,i===visible.length-1);
    }
    assert.equal(visible.every(lesson=>state.completed.includes(lesson.id)),true);
    const again=markLessonRead(state,guideLessons);
    assert.equal(again.state.completed.length,visible.length);
    assert.equal(again.finished,true);
  }
});

test('all guide destinations exist and both languages provide usable instructions', () => {
  const destinations = new Set(['arena','activity','rewards','system','account','classes','coach','units','unit-classes']);
  assert.equal(new Set(guideLessons.map(lesson=>lesson.id)).size,guideLessons.length);
  for(const lesson of guideLessons) {
    assert.ok(destinations.has(lesson.view));
    for(const lang of ['pt','en'] as const) {
      assert.ok(lesson.title[lang] && lesson.intro[lang] && lesson.note[lang] && lesson.actionLabel[lang]);
      assert.ok(lesson.steps[lang].length>=3);
      assert.equal(lesson.steps[lang].length,lesson.steps[lang==='pt'?'en':'pt'].length);
    }
  }
});
