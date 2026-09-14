import { useState } from 'react';
import AccountPanel, { AccountAvatar } from './AccountPanel';
import ClockWidget from './ClockWidget';
import { useAuth } from '../context/AuthContext';

export default function TopBar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <>
      <div className="app-account-wrap">
        <ClockWidget />
        <AccountAvatar
          name={user.name}
          photo={user.photo}
          size={36}
          onClick={() => setOpen(true)}
          title="Account, profile & work history"
        />
      </div>
      <AccountPanel
        open={open}
        onClose={() => setOpen(false)}
        account={user}
        kind="self"
      />
    </>
  );
}
