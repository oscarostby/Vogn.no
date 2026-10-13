import 'server-only';
import { decodeCursor, encodeCursor, isDateIdCursor, isDuplicateKeyError } from '@vogn/database';
import type { ConnectionItem, RelationshipState, UserSummary } from '@vogn/types';
import { ObjectId } from 'mongodb';
import type { AuthedContext } from '../context';
import { badRequest, forbidden, notFound } from '../errors';
import { loadUserSummaries } from '../mappers';
import { audit } from './audit';
import { notify } from './notifications';
import { getRelationship, getSettings, sharedCrewIds } from './users';

type Action = 'request' | 'accept' | 'decline' | 'cancel' | 'remove' | 'follow' | 'unfollow';

export async function connectionAction(ctx: AuthedContext, targetId: ObjectId, action: Action): Promise<RelationshipState> {
  const me = ctx.actor.userId;
  if (me.equals(targetId)) throw badRequest('You cannot connect with yourself.');
  const target = await ctx.cols.users.findOne({ _id: targetId, status: 'active' }, { projection: { _id: 1, displayName: 1 } });
  if (!target) throw notFound('User');
  const relationship = await getRelationship(ctx, me, targetId);
  const blockedByTarget = await ctx.cols.userBlocks.findOne({ blockerId: targetId, blockedId: me }, { projection: { _id: 1 } });

  switch (action) {
    case 'request': {
      if (relationship.blocked || blockedByTarget) throw forbidden();
      if (relationship.friendStatus === 'friends' || relationship.friendStatus === 'pending_outgoing') break;
      if (relationship.friendStatus === 'pending_incoming') return connectionAction(ctx, targetId, 'accept');
      const settings = await getSettings(ctx, targetId);
      const allowed =
        settings.friendRequests === 'everyone' ||
        (settings.friendRequests === 'crew_members' && (await sharedCrewIds(ctx, me, targetId)).length > 0);
      if (!allowed) throw forbidden('This person is not accepting friend requests.');
      try {
        await ctx.cols.userConnections.insertOne({
          _id: new ObjectId(),
          fromUserId: me,
          toUserId: targetId,
          kind: 'friend',
          status: 'pending',
          createdAt: ctx.now,
          updatedAt: ctx.now,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }
      await notify(ctx, {
        userId: targetId,
        type: 'friend_request',
        actorId: me,
        title: `${ctx.actor.displayName} sent you a friend request`,
        link: `/u/${ctx.actor.username}`,
        groupKey: `friend_request:${me.toHexString()}`,
      });
      break;
    }
    case 'accept': {
      const res = await ctx.cols.userConnections.updateOne(
        { fromUserId: targetId, toUserId: me, kind: 'friend', status: 'pending' },
        { $set: { status: 'accepted', updatedAt: ctx.now } },
      );
      if (!res.matchedCount) throw notFound('Friend request');
      // Remove any crossed outgoing request.
      await ctx.cols.userConnections.deleteOne({ fromUserId: me, toUserId: targetId, kind: 'friend', status: 'pending' });
      await notify(ctx, {
        userId: targetId,
        type: 'friend_accepted',
        actorId: me,
        title: `${ctx.actor.displayName} accepted your friend request`,
        link: `/u/${ctx.actor.username}`,
      });
      break;
    }
    case 'decline':
      await ctx.cols.userConnections.deleteOne({ fromUserId: targetId, toUserId: me, kind: 'friend', status: 'pending' });
      break;
    case 'cancel':
      await ctx.cols.userConnections.deleteOne({ fromUserId: me, toUserId: targetId, kind: 'friend', status: 'pending' });
      break;
    case 'remove':
      await ctx.cols.userConnections.deleteMany({
        kind: 'friend',
        $or: [
          { fromUserId: me, toUserId: targetId },
          { fromUserId: targetId, toUserId: me },
        ],
      });
      break;
    case 'follow': {
      if (relationship.blocked || blockedByTarget) throw forbidden();
      const settings = await getSettings(ctx, targetId);
      if (!settings.allowFollowers) throw forbidden('This person does not accept followers.');
      try {
        await ctx.cols.userConnections.insertOne({
          _id: new ObjectId(),
          fromUserId: me,
          toUserId: targetId,
          kind: 'follow',
          status: 'accepted',
          createdAt: ctx.now,
          updatedAt: ctx.now,
        });
        await notify(ctx, {
          userId: targetId,
          type: 'new_follower',
          actorId: me,
          title: `${ctx.actor.displayName} started following you`,
          link: `/u/${ctx.actor.username}`,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }
      break;
    }
    case 'unfollow':
      await ctx.cols.userConnections.deleteOne({ fromUserId: me, toUserId: targetId, kind: 'follow' });
      break;
  }
  return getRelationship(ctx, me, targetId);
}

export async function blockUser(ctx: AuthedContext, targetId: ObjectId): Promise<void> {
  const me = ctx.actor.userId;
  if (me.equals(targetId)) throw badRequest('You cannot block yourself.');
  const exists = await ctx.cols.users.findOne({ _id: targetId }, { projection: { _id: 1 } });
  if (!exists) throw notFound('User');
  try {
    await ctx.cols.userBlocks.insertOne({ _id: new ObjectId(), blockerId: me, blockedId: targetId, createdAt: ctx.now });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
  // Blocking removes friendship/follow edges in both directions.
  await ctx.cols.userConnections.deleteMany({
    $or: [
      { fromUserId: me, toUserId: targetId },
      { fromUserId: targetId, toUserId: me },
    ],
  });
  await audit(ctx, { action: 'user.blocked', targetType: 'user', targetId });
}

export async function unblockUser(ctx: AuthedContext, targetId: ObjectId): Promise<void> {
  await ctx.cols.userBlocks.deleteOne({ blockerId: ctx.actor.userId, blockedId: targetId });
}

export async function listBlocks(ctx: AuthedContext): Promise<UserSummary[]> {
  const blocks = await ctx.cols.userBlocks.find({ blockerId: ctx.actor.userId }).sort({ createdAt: -1 }).limit(500).toArray();
  const users = await loadUserSummaries(ctx.cols.users, blocks.map((b) => b.blockedId));
  return blocks.map((b) => users.get(b.blockedId.toHexString())).filter((u): u is UserSummary => Boolean(u));
}

export async function listConnections(
  ctx: AuthedContext,
  status: 'friends' | 'incoming' | 'outgoing' | 'followers' | 'following',
  cursor: string | undefined,
  limit = 50,
): Promise<{ items: ConnectionItem[]; nextCursor: string | null }> {
  const me = ctx.actor.userId;
  const filter: Record<string, unknown> =
    status === 'friends'
      ? { kind: 'friend', status: 'accepted', $or: [{ fromUserId: me }, { toUserId: me }] }
      : status === 'incoming'
        ? { kind: 'friend', status: 'pending', toUserId: me }
        : status === 'outgoing'
          ? { kind: 'friend', status: 'pending', fromUserId: me }
          : status === 'followers'
            ? { kind: 'follow', toUserId: me }
            : { kind: 'follow', fromUserId: me };
  const c = decodeCursor(cursor, isDateIdCursor);
  if (c) {
    const at = new Date(c.t);
    const id = ObjectId.createFromHexString(c.id);
    filter.$and = [{ $or: [{ updatedAt: { $lt: at } }, { updatedAt: at, _id: { $lt: id } }] }];
  }
  const edges = await ctx.cols.userConnections.find(filter).sort({ updatedAt: -1, _id: -1 }).limit(limit).toArray();
  const otherIds = edges.map((e) => (e.fromUserId.equals(me) ? e.toUserId : e.fromUserId));
  const users = await loadUserSummaries(ctx.cols.users, otherIds);
  const items = edges
    .map((e, i) => {
      const user = users.get(otherIds[i]!.toHexString());
      if (!user) return null;
      const friendStatus: ConnectionItem['status'] =
        e.kind === 'friend' ? (e.status === 'accepted' ? 'friends' : e.fromUserId.equals(me) ? 'pending_outgoing' : 'pending_incoming') : 'none';
      return { user, status: friendStatus, since: e.updatedAt.toISOString() };
    })
    .filter((x): x is ConnectionItem => Boolean(x));
  const last = edges[edges.length - 1];
  return { items, nextCursor: edges.length === limit && last ? encodeCursor({ t: last.updatedAt.getTime(), id: last._id.toHexString() }) : null };
}
