import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import InboxView from '@linen/ui/InboxView';
import { useLinenStore } from '@/store';
import Loading from '@/components/Loading';
import { api } from '@/fetcher';
import { mockedComponent, mockedFunction } from '@/mock';
import { useEffect } from 'react';
import { localStorage } from '@linen/utilities/storage';

type InboxPageProps = {
  communityName: string;
};

export default function InboxPage() {
  const { communityName } = useParams() as InboxPageProps;
  const setInboxProps = useLinenStore((state) => state.setInboxProps);
  const { isLoading, error } = useQuery({
    queryKey: ['inbox', { communityName }],
    queryFn: () =>
      api.getInboxProps({ communityName }).then((data) => {
        setInboxProps(data, communityName);
        return data;
      }),
    enabled: !!communityName,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    localStorage.set('pages_last', `/s/${communityName}/inbox`);
  }, [communityName]);

  if (!communityName || isLoading) {
    return <Loading />;
  }
  if (error) {
    return <>An error has occurred: {JSON.stringify(error)}</>;
  }
  return <View />;
}

function View() {
  const inboxProps = useLinenStore((state) => state.inboxProps);

  if (!inboxProps) {
    return <Loading />;
  }

  return (
    <InboxView
      channels={inboxProps.channels}
      currentCommunity={inboxProps.currentCommunity}
      dms={inboxProps.dms}
      isSubDomainRouting={inboxProps.isSubDomainRouting}
      permissions={inboxProps.permissions}
      settings={inboxProps.settings}
      api={api}
      // TODO:
      JoinChannelLink={mockedComponent}
      addReactionToThread={mockedFunction}
    />
  );
}
