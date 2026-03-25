import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('Study page should support timer route', () => {
  const studyTsx = read('src/screens/Study.tsx');

  // Study.tsx should check for timer route
  assert.equal(studyTsx.includes('isTimer'), true, 'Study should check for timer route');
  assert.equal(studyTsx.includes('/timer'), true, 'Study should handle /timer path');
});

test('Study timer should use TimerView component', () => {
  const studyTsx = read('src/screens/Study.tsx');

  assert.equal(studyTsx.includes('import TimerView from'), true, 'Study should import TimerView');
  assert.equal(studyTsx.includes('<TimerView'), true, 'Study should render TimerView component');
});

test('TimerView should accept timeObj and isCompleted props', () => {
  const timerViewTsx = read('src/features/study/components/TimerView.tsx');

  // TimerView should have interface with timeObj and isCompleted
  assert.equal(timerViewTsx.includes('timeObj'), true, 'TimerView should accept timeObj prop');
  assert.equal(timerViewTsx.includes('isCompleted'), true, 'TimerView should accept isCompleted prop');
});

test('TimerView should render time display digits', () => {
  const timerViewTsx = read('src/features/study/components/TimerView.tsx');

  // Timer should show formatted time (m and s from timeObj)
  assert.equal(timerViewTsx.includes('timeObj.m'), true, 'TimerView should display minutes');
  assert.equal(timerViewTsx.includes('timeObj.s'), true, 'TimerView should display seconds');
});

test('TimerView should have close and stop focus callbacks', () => {
  const timerViewTsx = read('src/features/study/components/TimerView.tsx');

  assert.equal(timerViewTsx.includes('onCloseClick'), true, 'TimerView should have onCloseClick prop');
  assert.equal(timerViewTsx.includes('onStopFocus'), true, 'TimerView should have onStopFocus prop');
});

test('Study timer route should be defined in App.tsx', () => {
  const appTsx = read('src/App.tsx');

  // Study timer route should be defined
  assert.equal(appTsx.includes('/study/timer'), true, 'App should define /study/timer route');
  assert.equal(appTsx.includes('Study key="study-timer"'), true, 'App should render Study with timer key');
});
