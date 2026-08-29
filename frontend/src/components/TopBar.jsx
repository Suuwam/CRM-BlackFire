import { useState } from 'react';
import AccountPanel, { AccountAvatar } from './AccountPanel';
import { useAuth } from '../context/AuthContext';

export default function TopBar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <>
      <div className="app-account-wrap">
        <AccountAvatar
          name={user.name}
          size={36}
          onClick={() => setOpen(true)}
          title="Account, email & password"
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
