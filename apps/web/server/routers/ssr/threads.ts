import { Router } from 'express';
import { z } from 'zod';
import { channels, threads } from '@linen/database';
import {
  SerializedAccount,
  AuthedRequestWithBody,
  Response,
} from '@linen/types';
import { serializeThread } from '@linen/serializers/thread';
import { serializeChannel } from '@linen/serializers/channel';
import { serializeSettings } from '@linen/serializers/settings';
import { serializeAccount } from '@linen/serializers/account';
import validationMiddleware from 'server/middlewares/validation';
import { findThreadByIncrementId } from 'services/threads';
import ChannelsService, { getDMs } from 'services/channels';
import CommunityService from 'services/community';
import PermissionsService from 'services/permissions';

const prefix = '/api/ssr/threads';
const ssrRouter = Router();

const getSchema = z.object({
  threadId: z.string(),
  communityName: z.string(),
  slug: z.string().optional(),
});

ssrRouter.get(
  `${prefix}`,
  validationMiddleware(getSchema, 'body'),
  async (
    req: AuthedRequestWithBody<z.infer<typeof getSchema>>,
    res: Response
  ) => {
    const { communityName, threadId } = req.body;

    const community = await CommunityService.find({ communityName });
    if (!community) {
      res.status(404);
      return res.end();
    }

    const permissions = await PermissionsService.get({
      params: { communityName },
      request: req,
      response: res,
    });

    if (!permissions.access) {
      res.status(403);
      return res.end();
    }

    const channels = await ChannelsService.find(community.id);
    const privateChannels = !!permissions.user?.id
      ? await ChannelsService.findPrivates({
          accountId: community.id,
          userId: permissions.user.id,
        })
      : [];

    const settings = serializeSettings(community);
    const communities = !!permissions.auth?.id
      ? await CommunityService.findByAuthId(permissions.auth.id)
      : [];

    const currentCommunity = serializeAccount(community);

    const dms = !!permissions.user?.id
      ? await getDMs({
          accountId: currentCommunity.id,
          userId: permissions.user.id,
        })
      : [];

    const id = parseInt(threadId);
    if (!id) {
      res.status(404);
      return res.end();
    }

    const thread = await findThreadByIncrementId(id);

    if (!thread || !thread?.channel?.accountId) {
      res.status(404);
      return res.end();
    }

    if (thread?.channel?.accountId !== currentCommunity.id) {
      res.status(404);
      return res.end();
    }

    const threadUrl: string | null = getThreadUrl(thread, currentCommunity);

    const currentChannel = [...channels, ...dms, ...privateChannels].find(
      (c) => c.id === thread.channel?.id
    )!;

    if (!currentChannel) {
      res.status(404);
      return res.end();
    }

    res.json({
      token: permissions.token,
      currentCommunity,
      channels: [...channels, ...privateChannels].map(serializeChannel),
      communities: communities.map(serializeAccount),
      permissions,
      settings,
      dms: dms.map(serializeChannel),
      thread: serializeThread(thread),
      currentChannel: serializeChannel(currentChannel),
      threadUrl,
      isSubDomainRouting: false,
      isBot: false,
    });
    res.end();
  }
);

function getThreadUrl(
  thread: threads & { channel?: channels },
  currentCommunity: SerializedAccount
) {
  let threadUrl: string | null = null;

  if (thread.externalThreadId) {
    if (currentCommunity.communityInviteUrl) {
      if (
        currentCommunity.communityInviteUrl.includes(
          'slack.com/join/shared_invite'
        )
      ) {
        threadUrl =
          currentCommunity.communityInviteUrl &&
          `${currentCommunity.communityInviteUrl}/archives/${
            thread?.channel?.externalChannelId
          }/p${(parseFloat(thread.externalThreadId) * 1000000).toString()}`;
      } else {
        threadUrl = currentCommunity.communityInviteUrl;
      }
    } else {
      threadUrl =
        currentCommunity.communityUrl +
        '/archives/' +
        thread?.channel?.externalChannelId +
        '/p' +
        (parseFloat(thread.externalThreadId) * 1000000).toString();
    }
  }

  if (currentCommunity.discordServerId) {
    threadUrl = `https://discord.com/channels/${currentCommunity.discordServerId}/${thread?.channel?.externalChannelId}/${thread.externalThreadId}`;
  }
  return threadUrl;
}

export default ssrRouter;