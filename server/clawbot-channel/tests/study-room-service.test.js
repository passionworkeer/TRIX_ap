const test = require('node:test');
const assert = require('node:assert/strict');
const { createStudyRoomService } = require('../services/studyRoomService');

function expectCode(code) {
  return (error) => Boolean(error && error.code === code);
}

test('createRoom should create room with host member and room code', () => {
  const service = createStudyRoomService({ roomCodeLength: 6, defaultMaxMembers: 5 });
  const created = service.createRoom({
    userId: 'user-host-1',
    displayName: 'Host'
  });

  assert.equal(typeof created.roomCode, 'string');
  assert.equal(created.roomCode.length, 6);
  assert.equal(created.room.hostUserId, 'user-host-1');
  assert.equal(created.room.sessionState, 'idle');
  assert.equal(created.room.members.length, 1);
  assert.equal(created.room.members[0].status, 'online');
});

test('joinRoom should reject when room reaches max members', () => {
  const service = createStudyRoomService({ defaultMaxMembers: 2 });
  const created = service.createRoom({ userId: 'u1', displayName: 'U1' });

  service.joinRoom({
    userId: 'u2',
    roomCode: created.roomCode,
    displayName: 'U2'
  });

  assert.throws(() => {
    service.joinRoom({
      userId: 'u3',
      roomCode: created.roomCode,
      displayName: 'U3'
    });
  }, expectCode('ROOM_FULL'));
});

test('hostAction should reject non-host caller', () => {
  const service = createStudyRoomService();
  const created = service.createRoom({ userId: 'host-user', displayName: 'Host' });

  service.joinRoom({
    userId: 'member-user',
    roomCode: created.roomCode,
    displayName: 'Member'
  });

  assert.throws(() => {
    service.hostAction({
      userId: 'member-user',
      roomCode: created.roomCode,
      action: 'start_focus'
    });
  }, expectCode('HOST_ONLY_ACTION'));
});

test('hostAction should update room session and member statuses', () => {
  const service = createStudyRoomService();
  const created = service.createRoom({ userId: 'host-user', displayName: 'Host' });

  service.joinRoom({
    userId: 'member-user',
    roomCode: created.roomCode,
    displayName: 'Member'
  });

  const focusing = service.hostAction({
    userId: 'host-user',
    roomCode: created.roomCode,
    action: 'start_focus'
  });
  assert.equal(focusing.room.sessionState, 'focusing');
  assert.deepEqual(
    focusing.room.members.map((member) => member.status),
    ['focusing', 'focusing']
  );

  const resting = service.hostAction({
    userId: 'host-user',
    roomCode: created.roomCode,
    action: 'pause'
  });
  assert.equal(resting.room.sessionState, 'resting');
  assert.deepEqual(
    resting.room.members.map((member) => member.status),
    ['resting', 'resting']
  );

  const ended = service.hostAction({
    userId: 'host-user',
    roomCode: created.roomCode,
    action: 'end'
  });
  assert.equal(ended.room.sessionState, 'idle');
  assert.deepEqual(
    ended.room.members.map((member) => member.status),
    ['online', 'online']
  );
});

test('leaveRoom should transfer host to earliest joined member', () => {
  const service = createStudyRoomService();
  const created = service.createRoom({ userId: 'host-user', displayName: 'Host' });

  service.joinRoom({
    userId: 'member-a',
    roomCode: created.roomCode,
    displayName: 'MemberA'
  });

  service.joinRoom({
    userId: 'member-b',
    roomCode: created.roomCode,
    displayName: 'MemberB'
  });

  const afterHostLeave = service.leaveRoom({
    userId: 'host-user',
    roomCode: created.roomCode
  });

  assert.equal(afterHostLeave.room.hostUserId, 'member-a');
  assert.equal(afterHostLeave.room.members.length, 2);
});

test('leaveRoom should destroy room after last member leaves', () => {
  const service = createStudyRoomService();
  const created = service.createRoom({ userId: 'host-user', displayName: 'Host' });

  const afterLeave = service.leaveRoom({
    userId: 'host-user',
    roomCode: created.roomCode
  });

  assert.equal(afterLeave.room, null);
  assert.equal(service.getRoomCodeForUser('host-user'), null);
  assert.throws(() => {
    service.getRoomState({ userId: 'host-user', roomCode: created.roomCode });
  }, (error) => Boolean(error && (error.code === 'NOT_IN_ROOM' || error.code === 'ROOM_NOT_FOUND')));
});
