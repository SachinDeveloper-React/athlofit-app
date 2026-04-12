import { memo } from 'react';
import { AppView, Avatar } from '../../../../components';

export const AccountAvatar = memo(
  ({ uri, name }: { uri?: string; name?: string }) => {
    return (
      <AppView>
        <Avatar uri={uri || undefined} name={name} size="2xl" shape="rounded" />
      </AppView>
    );
  },
);
