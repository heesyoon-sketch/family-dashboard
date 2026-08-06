import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRewardGoalId, parseRewardGoals, rewardGoalProgress } from './rewardGoals';

test('reward goal settings parse text and json values safely', () => {
  assert.equal(parseRewardGoalId('{"rewardId":"reward-1"}'), 'reward-1');
  assert.equal(parseRewardGoalId({ rewardId: 'reward-2' }), 'reward-2');
  assert.equal(parseRewardGoalId('broken'), null);
});

test('reward goals stay inside known family members and visible rewards', () => {
  const goals = parseRewardGoals(
    [
      { key: 'reward_goal:kid-1', value: '{"rewardId":"game"}' },
      { key: 'reward_goal:kid-2', value: '{"rewardId":"missing"}' },
      { key: 'reward_goal:outsider', value: '{"rewardId":"game"}' },
    ],
    new Set(['kid-1', 'kid-2']),
    new Set(['game']),
  );
  assert.deepEqual(goals, { 'kid-1': 'game' });
});

test('reward goal progress caps cleanly at the reward price', () => {
  assert.deepEqual(rewardGoalProgress(420, 600), { remaining: 180, percent: 70, reached: false });
  assert.deepEqual(rewardGoalProgress(650, 600), { remaining: 0, percent: 100, reached: true });
});
