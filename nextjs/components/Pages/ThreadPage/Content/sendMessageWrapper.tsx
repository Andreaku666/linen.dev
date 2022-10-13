import { SerializedMessage } from 'serializers/message';
import { MessageFormat, Roles } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { StartSignUpFn } from 'contexts/Join';
import { SerializedUser } from 'serializers/user';
import debounce from 'utilities/debounce';

const debouncedSendMessage = debounce(
  ({ message, communityId, channelId, threadId, imitationId }: any) => {
    return fetch(`/api/messages/thread`, {
      method: 'POST',
      body: JSON.stringify({
        body: message,
        communityId,
        channelId,
        threadId,
        imitationId,
      }),
    });
  },
  100
);

export function sendMessageWrapper({
  currentUser,
  startSignUp,
  currentCommunity,
  allUsers,
  setMessages,
}: {
  currentUser: any;
  startSignUp?: StartSignUpFn;
  currentCommunity: any;
  allUsers: SerializedUser[];
  setMessages: Function;
}) {
  return ({
    message,
    channelId,
    threadId,
  }: {
    message: string;
    channelId: string;
    threadId: string;
  }) => {
    if (!currentUser) {
      startSignUp?.({
        communityId: currentCommunity?.id!,
        onSignIn: {
          run: sendMessageWrapper,
          init: {
            currentCommunity,
            allUsers,
            setMessages,
          },
          params: {
            message,
            channelId,
            threadId,
          },
        },
      });
      return;
    }
    const imitation: SerializedMessage = {
      id: uuid(),
      body: message,
      sentAt: new Date().toString(),
      usersId: currentUser.id,
      mentions: allUsers,
      attachments: [],
      reactions: [],
      threadId,
      messageFormat: MessageFormat.LINEN,
      author: {
        id: currentUser.id,
        externalUserId: currentUser.externalUserId,
        displayName: currentUser.displayName,
        profileImageUrl: currentUser.profileImageUrl,
        isBot: false,
        isAdmin: false,
        anonymousAlias: null,
        accountsId: 'fake-account-id',
        authsId: null,
        role: Roles.MEMBER,
      },
    };

    setMessages((messages: SerializedMessage[]) => {
      return [...messages, imitation];
    });

    return debouncedSendMessage({
      message,
      communityId: currentCommunity?.id,
      channelId,
      threadId,
      imitationId: imitation.id,
    })
      .then((response: any) => {
        if (response.ok) {
          return response.json();
        }
        throw 'Could not send a message';
      })
      .then(
        ({
          message,
          imitationId,
        }: {
          message: SerializedMessage;
          imitationId: string;
        }) => {
          setMessages((messages: SerializedMessage[]) => {
            const messageId = message.id;
            const index = messages.findIndex((t) => t.id === messageId);
            if (index >= 0) {
              return messages;
            }
            return [
              ...messages.filter((message) => message.id !== imitationId),
              message,
            ];
          });
        }
      );
  };
}